require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const MongoStore = require('connect-mongo').default;

const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bwipjs = require('bwip-js');
const cloudinary = require('cloudinary').v2;
const { ZipArchive } = require('archiver');
const { validateRecord } = require('./services/mmr/schema.js');
const { getDateCompleted, formatRecordMonthLabel } = require('./services/mmr/dateLogic.js');
const { fillMmr } = require('./services/mmr/pdfFill.js');
const { parseCsv } = require('./services/mmr/parseInput.js');

const MaintenanceRequest = require('./models/MaintenanceRequest');
const EveningWalkthrough = require('./models/EveningWalkthrough');
const WeekendWalkthrough = require('./models/WeekendWalkthrough');
const Vehicle = require('./models/Vehicle');
const Task = require('./models/Task');
const ChecklistItem = require('./models/ChecklistItem');
const Entity = require('./models/Entity');
const QRCode = require('qrcode');

// 2. const app = express()
const app = express();

// --- Auth Bypass Middleware ---
// Removed for production / onboarding testing
// If you want to bypass auth again, you can uncomment this block.
/*
app.use(async (req, res, next) => {
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
        try {
            const defaultEntity = await Entity.findOne({ name: 'Default Fleet' });
            req.user = { 
                id: 'mock-admin-id', 
                name: 'Local Admin', 
                role: 'admin',
                entityId: defaultEntity ? defaultEntity._id : null
            };
        } catch (err) {
            console.error("Auth bypass error", err);
        }
    }
    next();
});
*/

// 3. app.set('trust proxy', 1)
app.set('trust proxy', 1);

// 4. app.set('view engine', 'ejs')
app.set('view engine', 'ejs');

// 5. app.set('views', './views')
app.set('views', path.join(__dirname, 'views'));

// 6. Security middleware (helmet, cors)
// Helmet is configured to allow our CDN scripts and styles
app.use(helmet({
    contentSecurityPolicy: false, // Disabling temporarily to ensure Tailwind CDN and other scripts work out of the box without complex CSP config
    crossOriginOpenerPolicy: false, // Prevents HTTP console warnings on Namecheap
    originAgentCluster: false, // Prevents HTTP console warnings on Namecheap
}));
app.use(cors());

// 7. app.use(express.json())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 8. app.use(express.static('public'))
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Setup ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'fleetman_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleet_man' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));
app.use(passport.initialize());
app.use(passport.session());

const User = require('./models/User');
const JoinRequest = require('./models/JoinRequest');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
    callbackURL: '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user);
        }
        
        // CREATE NEW USER WITHOUT ENTITY
        user = await User.create({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            role: 'unassigned' // No entityId yet
        });

        done(null, user);
    } catch (err) {
        done(err, null);
    }
  }
));

// --- Auth Routes ---
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login?error=true' }),
    (req, res) => {
        // If unassigned, go to onboarding, else go to roster
        if (req.user.role === 'unassigned') {
            res.redirect('http://127.0.0.1:3000/onboarding');
        } else {
            res.redirect('http://127.0.0.1:3000/roster'); 
        }
    }
);

app.post('/api/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.json({ success: true });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// --- Onboarding APIs ---
app.post('/api/onboarding/create-entity', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'unassigned') return res.status(400).json({ error: 'User is already assigned to an entity' });
    
    try {
        const { entityName } = req.body;
        if (!entityName) return res.status(400).json({ error: 'Entity name required' });

        const newEntity = await Entity.create({ name: entityName, contactEmail: req.user.email });
        
        req.user.entityId = newEntity._id;
        req.user.role = 'admin';
        await req.user.save();
        
        res.json({ success: true, entity: newEntity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/onboarding/request-join', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'unassigned') return res.status(400).json({ error: 'User is already assigned to an entity' });
    
    try {
        const { entityName } = req.body;
        const targetEntity = await Entity.findOne({ name: entityName });
        if (!targetEntity) return res.status(404).json({ error: 'Entity not found. Check the name and try again.' });
        
        // Prevent duplicate requests
        const existing = await JoinRequest.findOne({ userId: req.user._id, entityId: targetEntity._id, status: 'pending' });
        if (existing) return res.status(400).json({ error: 'Request already pending' });

        await JoinRequest.create({ userId: req.user._id, entityId: targetEntity._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/onboarding/requests', async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    try {
        const requests = await JoinRequest.find({ entityId: req.user.entityId, status: 'pending' }).populate('userId', 'displayName email');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/onboarding/resolve', async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    try {
        const { requestId, action } = req.body; // action: 'approve' or 'reject'
        const joinReq = await JoinRequest.findById(requestId).populate('userId');
        
        if (!joinReq || joinReq.entityId.toString() !== req.user.entityId.toString()) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        if (action === 'approve') {
            joinReq.status = 'approved';
            joinReq.userId.entityId = req.user.entityId;
            joinReq.userId.role = 'driver'; // Default role
            await joinReq.userId.save();
        } else {
            joinReq.status = 'rejected';
        }
        
        await joinReq.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RBAC Middlewares ---
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

const isManagerOrAdmin = (req, res, next) => {
    if (req.isAuthenticated()) {
        if (req.user.role === 'manager' || req.user.role === 'admin') {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    res.status(401).json({ error: 'Unauthorized' });
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Seed mock vehicles if none exist
const seedVehicles = async (entityId) => {
    const count = await Vehicle.countDocuments();
    if (count === 0) {
        await Vehicle.insertMany([
            { routeNumber: 'R-01', truckNumber: 'TRK-101', entityId },
            { routeNumber: 'R-02', truckNumber: 'TRK-102', entityId },
            { routeNumber: 'R-03', truckNumber: 'TRK-103', entityId },
        ]);
        console.log('Seeded mock vehicles');
    }
};

const seedChecklistItems = async (entityId) => {
    const count = await ChecklistItem.countDocuments();
    if (count === 0) {
        await ChecklistItem.insertMany([
            { name: 'Scanner device', eveningWalkthrough: true, weekendWalkthrough: false, entityId },
            { name: 'Gas card', eveningWalkthrough: true, weekendWalkthrough: false, entityId },
            { name: 'Batteries', eveningWalkthrough: true, weekendWalkthrough: false, entityId },
            { name: 'Windscreen', eveningWalkthrough: false, weekendWalkthrough: true, entityId },
            { name: 'Wipers', eveningWalkthrough: false, weekendWalkthrough: true, entityId },
            { name: 'Mirrors', eveningWalkthrough: false, weekendWalkthrough: true, entityId },
            { name: 'Tires', eveningWalkthrough: false, weekendWalkthrough: true, entityId },
        ]);
        console.log('Seeded mock checklist items');
    }
};

mongoose.connection.once('open', async () => {
    let defaultEntity = await Entity.findOne({ name: 'Default Fleet' });
    if (!defaultEntity) {
        defaultEntity = await Entity.create({ name: 'Default Fleet', description: 'Local Development Fleet' });
        console.log('Seeded Default Fleet Entity');
    }
    seedVehicles(defaultEntity._id);
    seedChecklistItems(defaultEntity._id);
});

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MMR Configs and Paths
const configPath = path.join(__dirname, 'config', 'company.json');
let mmrConfig = {};
if (fs.existsSync(configPath)) {
    mmrConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
const templatePath = path.join(__dirname, 'templates', 'MGBA-355.pdf');
const signaturesDir = path.join(__dirname, 'signatures');
if (!fs.existsSync(signaturesDir)) fs.mkdirSync(signaturesDir);

const uploadSignature = multer({ dest: 'uploads/' });
const uploadBatch = multer({ dest: 'uploads/' });

// 9. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// MMR API Routes
app.get('/api/signatures', (req, res) => {
  const files = fs.readdirSync(signaturesDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  res.json(files);
});

app.post('/api/signatures', uploadSignature.single('signature'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const { name } = req.body;
  if (!name) return res.status(400).send('Name is required.');

  const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
  const targetPath = path.join(signaturesDir, `${name}${ext}`);
  
  fs.renameSync(req.file.path, targetPath);
  res.json({ message: 'Signature saved', filename: `${name}${ext}` });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { signatureFilename, ...recordData } = req.body;
    const record = validateRecord(recordData);
    const dateCompleted = getDateCompleted(record.recordMonth, mmrConfig.dateCompletedStrategy);
    const monthLabel = formatRecordMonthLabel(record.recordMonth);
    const sigPath = signatureFilename ? path.join(signaturesDir, signatureFilename) : null;
    const pdfBytes = await fillMmr(record, mmrConfig, sigPath, templatePath, dateCompleted, monthLabel);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MMR_${record.unit}_${record.recordMonth}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/generate-batch', uploadBatch.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const signatureFilename = req.body.signatureFilename;
    const applySignature = req.body.applySignature === 'true';
    const companyName = req.body.companyName;
    const domicile = req.body.domicile;
    const sigPath = signatureFilename ? path.join(signaturesDir, signatureFilename) : null;

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    let records;
    if (req.file.originalname.toLowerCase().endsWith('.json')) {
      const parsedJson = JSON.parse(fileContent);
      records = parsedJson.map(r => validateRecord(r));
    } else {
      records = parseCsv(fileContent);
    }

    fs.unlinkSync(req.file.path);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="MMR_Batch.zip"');

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);

    for (const record of records) {
      record.companyName = companyName;
      record.applySignature = applySignature;
      record.domicile = domicile;
      const dateCompleted = getDateCompleted(record.recordMonth, mmrConfig.dateCompletedStrategy);
      const monthLabel = formatRecordMonthLabel(record.recordMonth);
      const pdfBytes = await fillMmr(record, mmrConfig, sigPath, templatePath, dateCompleted, monthLabel);
      
      archive.append(Buffer.from(pdfBytes), { name: `MMR_${record.unit}_${record.recordMonth}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// 10. API Routes

// --- Fleet Management Routes ---
const uploadVehicleDocs = multer({ dest: 'uploads/' });

const handleCloudinaryUpload = async (file) => {
    const result = await cloudinary.uploader.upload(file.path, {
        folder: 'fleetMan_vehicles'
    });
    fs.unlinkSync(file.path);
    return result.secure_url;
};

app.post('/api/vehicles', uploadVehicleDocs.fields([
    { name: 'registration', maxCount: 1 },
    { name: 'dotInspection', maxCount: 1 },
    { name: 'insurance', maxCount: 1 }
]), async (req, res) => {
    try {
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status, registrationExpiry } = req.body;
        
        const vehicleData = {
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status,
            entityId: req.user?.entityId
        };

        if (registrationExpiry) {
            vehicleData.registrationExpiry = new Date(registrationExpiry);
        }

        if (req.files) {
            if (req.files['registration']) {
                vehicleData.registrationUrl = await handleCloudinaryUpload(req.files['registration'][0]);
            }
            if (req.files['dotInspection']) {
                vehicleData.dotInspectionUrl = await handleCloudinaryUpload(req.files['dotInspection'][0]);
            }
            if (req.files['insurance']) {
                vehicleData.insuranceUrl = await handleCloudinaryUpload(req.files['insurance'][0]);
            }
        }

        const vehicle = new Vehicle(vehicleData);
        await vehicle.save();
        if (req.accepts('json')) return res.json(vehicle);
        res.redirect('/vehicles');
    } catch (err) {
        console.error(err);
        if (req.accepts('json')) return res.status(500).json({ error: 'Error adding vehicle' });
        res.status(500).send('Error adding vehicle');
    }
});

app.post('/api/vehicles/:id', uploadVehicleDocs.fields([
    { name: 'registration', maxCount: 1 },
    { name: 'dotInspection', maxCount: 1 },
    { name: 'insurance', maxCount: 1 }
]), async (req, res) => {
    try {
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status, registrationExpiry } = req.body;
        
        const vehicleData = {
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status,
            entityId: req.user?.entityId
        };

        if (registrationExpiry) {
            vehicleData.registrationExpiry = new Date(registrationExpiry);
        }

        if (req.files) {
            if (req.files['registration']) {
                vehicleData.registrationUrl = await handleCloudinaryUpload(req.files['registration'][0]);
            }
            if (req.files['dotInspection']) {
                vehicleData.dotInspectionUrl = await handleCloudinaryUpload(req.files['dotInspection'][0]);
            }
            if (req.files['insurance']) {
                vehicleData.insuranceUrl = await handleCloudinaryUpload(req.files['insurance'][0]);
            }
        }

        const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, vehicleData, { new: true });
        if (req.accepts('json')) return res.json(vehicle);
        res.redirect('/vehicles');
    } catch (err) {
        console.error(err);
        if (req.accepts('json')) return res.status(500).json({ error: 'Error updating vehicle' });
        res.status(500).send('Error updating vehicle');
    }
});

app.post('/api/vehicles/bulk', async (req, res) => {
    try {
        const vehicles = req.body;
        if (!Array.isArray(vehicles)) return res.status(400).json({ error: 'Expected an array of vehicles' });
        
        let successCount = 0;
        let errors = [];
        
        for (const v of vehicles) {
            try {
                if (!v.truckNumber) {
                    errors.push({ truck: 'Unknown', error: 'Missing truck number' });
                    continue;
                }
                v.entityId = req.user?.entityId;
                if (!v.routeNumber) v.routeNumber = 'Unassigned';
                
                await Vehicle.create(v);
                successCount++;
            } catch (err) {
                errors.push({ truck: v.truckNumber, error: err.message });
            }
        }

        res.json({ success: true, count: successCount, errors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing bulk upload' });
    }
});


app.get('/api/vehicles/:id/barcode', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        const barcodeString = `V${vehicle.truckNumber}`;
        const pngBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeString,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });
        
        res.set('Content-Type', 'image/png');
        res.send(pngBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate barcode' });
    }
});

// --- Maintenance Routes ---

const uploadTemp = multer({ dest: 'uploads/' });
app.post('/api/maintenance', uploadTemp.single('photo'), async (req, res) => {
    try {
        const { title, description, vehicleId, priority } = req.body;
        let photoUrl = null;

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'fleetMan'
            });
            photoUrl = result.secure_url;
            fs.unlinkSync(req.file.path); // Clean up temp file
        }

        const newRequest = new MaintenanceRequest({
            entityId: req.user?.entityId,
            title,
            description,
            vehicleId,
            priority,
            photoUrl
        });
        await newRequest.save();

        // Automatically create a Task for the dashboard
        const vehicle = await Vehicle.findById(vehicleId);
        const taskTitle = vehicle ? `Maintenance Request - ${vehicle.truckNumber}` : `Maintenance Request - ${title}`;
        await Task.create({
            entityId: req.user?.entityId,
            title: taskTitle,
            description: description,
            category: 'maintenance',
            referenceId: newRequest._id
        });

        if (req.accepts('json')) return res.json(newRequest);
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        if (req.accepts('json')) return res.status(500).json({ error: 'Error submitting maintenance request' });
        res.status(500).send('Error submitting maintenance request');
    }
});

// --- Evening Walkthrough Routes ---
// Auto-save endpoint for Evening Walkthrough
app.patch('/api/walkthrough/evening/autosave', async (req, res) => {
    try {
        const { vehicleId, date, checks, maintenanceNote, routing, status } = req.body;
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        let walkthrough = await EveningWalkthrough.findOne({
            entityId: req.user?.entityId,
            vehicleId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (!walkthrough) {
            walkthrough = new EveningWalkthrough({ entityId: req.user?.entityId, vehicleId, date: new Date(date) });
        }

        if (checks) walkthrough.checks = { ...walkthrough.checks, ...checks };
        if (maintenanceNote !== undefined) walkthrough.maintenanceNote = maintenanceNote;
        if (routing !== undefined) walkthrough.routing = routing;
        if (status) walkthrough.status = status;

        await walkthrough.save();

        // If marked completed, generate tasks
        if (status === 'completed') {
            const vehicle = await Vehicle.findById(vehicleId);
            
            let missingItems = [];
            if (walkthrough.checks) {
                for (const [key, value] of Object.entries(walkthrough.checks)) {
                    if (value === 'fail') missingItems.push(key);
                }
            }
            
            if (missingItems.length > 0) {
                await Task.create({
            entityId: req.user?.entityId,
                    title: `Missing Items - ${vehicle.truckNumber}`,
                    description: missingItems.join(', '),
                    category: 'walkthrough-issue',
                    referenceId: walkthrough._id
                });
            }
            if (walkthrough.maintenanceNote) {
                await Task.create({
            entityId: req.user?.entityId,
                    title: `Maintenance (${routing}) - ${vehicle.truckNumber}`,
                    description: walkthrough.maintenanceNote,
                    category: 'maintenance',
                    referenceId: walkthrough._id
                });
            }
        }

        res.json({ success: true, walkthrough });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to autosave' });
    }
});

// --- Weekend Walkthrough Routes ---
app.post('/api/walkthrough/weekend', async (req, res) => {
    try {
        const { vehicleId, mileage, bodyDamage, maintenanceNote, notes, ...dynamicChecks } = req.body;
        
        let compiledNotes = maintenanceNote || '';
        
        const assetChecks = {};
        for (const [key, value] of Object.entries(dynamicChecks)) {
            if (key.endsWith('Status')) {
                const item = key.replace('Status', '');
                assetChecks[item] = { status: value, notes: dynamicChecks[`${item}Notes`] || '' };
            }
        }

        // Automatically append any failed asset checks to the maintenance note
        for (const [key, check] of Object.entries(assetChecks)) {
            if (check.status === 'fail' && check.notes) {
                compiledNotes += `\n[${key.toUpperCase()} FAIL]: ${check.notes}`;
            }
        }
        
        const walkthrough = new WeekendWalkthrough({
            entityId: req.user?.entityId,
            vehicleId,
            mileage: Number(mileage),
            assetChecks,
            maintenanceNote: compiledNotes.trim(),
            notes: notes ? notes + `\nBody Damage: ${bodyDamage || 'None'}` : `Body Damage: ${bodyDamage || 'None'}`
        });
        await walkthrough.save();

        const vehicle = await Vehicle.findById(vehicleId);

        // Generate Maintenance Task if note exists
        if (maintenanceNote) {
            await Task.create({
            entityId: req.user?.entityId,
                title: `Maintenance (Weekend) - ${vehicle.truckNumber}`,
                description: maintenanceNote,
                category: 'maintenance',
                referenceId: walkthrough._id
            });
        }

        // --- MMR AUTOMATION TRIGGER ---
        const today = new Date();
        if (today.getDate() <= 5) {
            const lastMonth = new Date();
            lastMonth.setMonth(today.getMonth() - 1);
            lastMonth.setDate(1);
            
            const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const recentRepairs = await MaintenanceRequest.find({
                entityId: req.user?.entityId,
                vehicleId: vehicle.truckNumber,
                status: 'completed',
                updatedAt: { $gte: lastMonth, $lt: startOfThisMonth }
            });

            const repairLog = recentRepairs.map(r => r.title + ': ' + r.description).join('; ');
            
            console.log(`[MMR Automation] Generating MMR for Vehicle ${vehicle.truckNumber} with Mileage ${mileage} and repairs: ${repairLog}`);
            
            // Generate Task to notify admin that an MMR was auto-generated
            await Task.create({
            entityId: req.user?.entityId,
                title: `Auto-MMR Generated - ${vehicle.truckNumber}`,
                description: `Mileage: ${mileage}. Repairs logged: ${repairLog || 'None'}`,
                category: 'general',
                referenceId: walkthrough._id
            });
        }

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error submitting weekend walkthrough');
    }
});

// --- Next.js Frontend APIs ---
app.get('/api/checklist-items', async (req, res) => {
    try {
        const items = await ChecklistItem.find({ entityId: req.user?.entityId }).sort('name');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/checklist-items', async (req, res) => {
    try {
        const item = new ChecklistItem({ ...req.body, entityId: req.user?.entityId });
        await item.save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/checklist-items/:id', async (req, res) => {
    try {
        const item = await ChecklistItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/checklist-items/:id', async (req, res) => {
    try {
        await ChecklistItem.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard-data', async (req, res) => {
    try {
        const tasks = await Task.find({ entityId: req.user?.entityId }).sort('-createdAt').limit(20);
        const vehicles = await Vehicle.find({ entityId: req.user?.entityId });
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const maintenanceAlerts = vehicles.filter(v => v.status === 'active' && (!v.lastOilChange || v.lastOilChange < ninetyDaysAgo));
        
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const registrationAlerts = vehicles.filter(v => v.status === 'active' && v.registrationExpiry && v.registrationExpiry < thirtyDaysFromNow);

        res.json({ tasks, maintenanceAlerts, registrationAlerts, vehicles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vehicles-data', async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ entityId: req.user?.entityId }).sort('routeNumber');
        res.json(vehicles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/mmr-data', async (req, res) => {
    try {
        // We will just fetch weekend walkthroughs to simulate MMR records
        const records = await WeekendWalkthrough.find().populate('vehicleId').sort('-createdAt');
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. 404 catch-all
app.use((req, res) => {
    res.status(404).send('404 - Not Found'); // We can upgrade this to a view later
});

// 12. Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 - Internal Server Error');
});

// 13. app.listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
