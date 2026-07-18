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
const WalkthroughTemplate = require('./models/WalkthroughTemplate');
const WalkthroughRecord = require('./models/WalkthroughRecord');
const Vehicle = require('./models/Vehicle');
const Task = require('./models/Task');
const ChecklistItem = require('./models/ChecklistItem');
const Entity = require('./models/Entity');
const Partnership = require('./models/Partnership');
const QRCode = require('qrcode');

// 2. const app = express()
const app = express();

const isProd = process.env.NODE_ENV === 'production';
const hostUrl = process.env.HOST || 'fleetman.aceddivision.com';
const backendUrl = isProd ? `https://${hostUrl}` : 'http://localhost:3000';
const frontendUrl = isProd ? `https://${hostUrl}` : 'http://localhost:3001';

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
app.use(cors({
    origin: isProd ? true : ['http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true
}));

// 7. app.use(express.json())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 8. Serve static files in production, else simple API response
if (isProd) {
    app.use(express.static(path.join(__dirname, 'public')));
} else {
    app.get('/', (req, res) => {
        res.send('Server is live! Access the frontend at port 3001.');
    });
}

// --- Authentication Setup ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'fleetman_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleet_man' }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        sameSite: 'lax',
        secure: isProd
    }
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
    clientID: process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || 'dummy_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || 'dummy_secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${backendUrl}/api/auth/google/callback`
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
            res.redirect(`${frontendUrl}/onboarding`);
        } else {
            res.redirect(`${frontendUrl}/roster`); // or wherever the main app is
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
        const { entityName, entityType } = req.body;
        if (!entityName) return res.status(400).json({ error: 'Entity name required' });
        if (!entityType || !['dsp', 'msp'].includes(entityType)) return res.status(400).json({ error: 'Valid entityType (dsp or msp) required' });

        const newEntity = await Entity.create({ name: entityName, entityType, contactEmail: req.user.email });
        
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
        const { entityName, entityType } = req.body;
        const targetEntity = await Entity.findOne({ name: entityName });
        if (!targetEntity) return res.status(404).json({ error: 'Entity not found. Check the name and try again.' });
        if (entityType && targetEntity.entityType !== entityType) {
            return res.status(400).json({ error: `You selected ${entityType.toUpperCase()}, but the entity you are trying to join is a ${targetEntity.entityType.toUpperCase()}.` });
        }
        
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
            const targetEntity = await Entity.findById(req.user.entityId);
            joinReq.status = 'approved';
            joinReq.userId.entityId = req.user.entityId;
            joinReq.userId.role = targetEntity.entityType === 'msp' ? 'mechanic' : 'driver'; // Default role based on entity type
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

// --- Partnership APIs ---
app.get('/api/msp/directory', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const msps = await Entity.find({ entityType: 'msp', listedInDirectory: true })
            .select('name description contactEmail contactPhone specialties serviceRadius isVerified');
        res.json(msps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/partnerships', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const { targetEntityId } = req.body;
        const myEntityId = req.user.entityId;
        if (!targetEntityId || !myEntityId) return res.status(400).json({ error: 'Missing entity ID' });

        const myEntity = await Entity.findById(myEntityId);
        const targetEntity = await Entity.findById(targetEntityId);
        if (!myEntity || !targetEntity) return res.status(404).json({ error: 'Entity not found' });

        if (myEntity.entityType === targetEntity.entityType) {
            return res.status(400).json({ error: 'Partnerships must be between a DSP and an MSP' });
        }

        const dspEntityId = myEntity.entityType === 'dsp' ? myEntity._id : targetEntity._id;
        const mspEntityId = myEntity.entityType === 'msp' ? myEntity._id : targetEntity._id;

        const existing = await Partnership.findOne({ dspEntityId, mspEntityId });
        if (existing) return res.status(400).json({ error: 'Partnership already exists or is pending' });

        const p = await Partnership.create({
            dspEntityId,
            mspEntityId,
            status: 'requested',
            initiatedBy: myEntityId
        });
        res.json({ success: true, partnership: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/partnerships', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const myEntityId = req.user.entityId;
        const myEntity = await Entity.findById(myEntityId);
        
        let query = {};
        if (myEntity.entityType === 'dsp') query.dspEntityId = myEntityId;
        else query.mspEntityId = myEntityId;

        const partnerships = await Partnership.find(query)
            .populate('dspEntityId', 'name contactEmail')
            .populate('mspEntityId', 'name contactEmail specialties isVerified')
            .populate('initiatedBy', 'name');
            
        res.json(partnerships);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/partnerships/:id/respond', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'accept' | 'reject'
        const p = await Partnership.findById(req.params.id);
        if (!p) return res.status(404).json({ error: 'Partnership not found' });

        if (p.initiatedBy.toString() === req.user.entityId.toString()) {
            return res.status(403).json({ error: 'You cannot respond to a request you initiated' });
        }

        if (p.dspEntityId.toString() !== req.user.entityId.toString() && p.mspEntityId.toString() !== req.user.entityId.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (action === 'accept') p.status = 'active';
        else if (action === 'reject') p.status = 'terminated';
        else return res.status(400).json({ error: 'Invalid action' });

        p.respondedBy = req.user._id;
        p.respondedAt = new Date();
        await p.save();
        res.json({ success: true, partnership: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/partnerships/:id', isAuthenticated, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { status, terms, defaultAutoAssign } = req.body;
        const p = await Partnership.findById(req.params.id);
        if (!p) return res.status(404).json({ error: 'Partnership not found' });

        if (p.dspEntityId.toString() !== req.user.entityId.toString() && p.mspEntityId.toString() !== req.user.entityId.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (status && ['suspended', 'active', 'terminated'].includes(status)) {
            p.status = status;
        }
        if (terms !== undefined) p.terms = terms;
        if (defaultAutoAssign !== undefined && req.user.entityId.toString() === p.dspEntityId.toString()) {
            p.defaultAutoAssign = defaultAutoAssign;
        }

        await p.save();
        res.json({ success: true, partnership: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// --- Global API Auth & RBAC Middleware ---
app.use('/api', (req, res, next) => {
    // Exclude auth, onboarding, and webhook routes from global check
    if (req.path.startsWith('/auth') || req.path.startsWith('/onboarding')) {
        return next();
    }
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'unassigned') return res.status(403).json({ error: 'Forbidden: Complete onboarding first' });
    next();
});

// --- Team Management Routes ---
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({ entityId: req.user.entityId });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id/role', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const { role } = req.body;
        const targetUser = await User.findById(req.params.id);
        
        if (!targetUser || targetUser.entityId.toString() !== req.user.entityId.toString()) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only admins can promote to admin/manager or demote admins
        if (targetUser.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Cannot modify an admin' });
        }
        if ((role === 'admin' || role === 'manager') && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can grant manager privileges' });
        }

        if (role === 'remove') {
            targetUser.entityId = undefined;
            targetUser.role = 'unassigned';
        } else {
            targetUser.role = role;
        }

        await targetUser.save();
        res.json({ success: true, user: targetUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
            textyoffset: -5,
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
// --- Dynamic Walkthrough Routes ---

// Get all active templates for an entity
app.get('/api/walkthrough-templates', async (req, res) => {
    try {
        const templates = await WalkthroughTemplate.find({ entityId: req.user?.entityId, isActive: true });
        res.json(templates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Get a single template
app.get('/api/walkthrough-templates/:id', async (req, res) => {
    try {
        const template = await WalkthroughTemplate.findOne({ _id: req.params.id, entityId: req.user?.entityId });
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// Create or Update a template
app.post('/api/walkthrough-templates', async (req, res) => {
    try {
        const { _id, name, frequency, description, items, isActive } = req.body;
        
        const templateData = {
            entityId: req.user?.entityId,
            name, frequency, description, items, isActive: isActive !== false
        };

        let template;
        if (_id) {
            template = await WalkthroughTemplate.findOneAndUpdate({ _id, entityId: req.user?.entityId }, templateData, { new: true });
        } else {
            template = new WalkthroughTemplate(templateData);
            await template.save();
        }
        res.json(template);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save template' });
    }
});

// Delete a template (soft delete)
app.delete('/api/walkthrough-templates/:id', async (req, res) => {
    try {
        await WalkthroughTemplate.findOneAndUpdate({ _id: req.params.id, entityId: req.user?.entityId }, { isActive: false });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// Submit a walkthrough record
app.post('/api/walkthrough-records', async (req, res) => {
    try {
        const { templateId, vehicleId, date, mileage, data, maintenanceNote, status } = req.body;
        
        if (status === 'draft') {
            let record = await WalkthroughRecord.findOne({
                entityId: req.user?.entityId,
                templateId,
                vehicleId,
                reporterId: req.user?._id,
                status: 'draft'
            });

            if (record) {
                record.data = data;
                record.mileage = mileage;
                record.maintenanceNote = maintenanceNote;
                record.date = date ? new Date(date) : new Date();
                await record.save();
                return res.json(record);
            }
        }
        
        const record = new WalkthroughRecord({
            entityId: req.user?.entityId,
            templateId,
            vehicleId,
            reporterId: req.user?._id,
            date: date ? new Date(date) : new Date(),
            mileage,
            data,
            maintenanceNote,
            status: status || 'completed'
        });

        await record.save();
        res.json(record);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit walkthrough' });
    }
});

app.get('/api/walkthrough-records/draft', async (req, res) => {
    try {
        const { templateId, vehicleId } = req.query;
        if (!templateId || !vehicleId) {
            return res.status(400).json({ error: 'Missing parameters' });
        }
        
        const record = await WalkthroughRecord.findOne({
            entityId: req.user?.entityId,
            templateId,
            vehicleId,
            reporterId: req.user?._id,
            status: 'draft'
        });
        
        res.json({ draft: record });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
});

// Get walkthrough records
app.get('/api/walkthrough-records', async (req, res) => {
    try {
        const records = await WalkthroughRecord.find({ entityId: req.user?.entityId })
            .populate('templateId')
            .populate('vehicleId')
            .populate('reporterId', 'displayName email')
            .sort('-createdAt')
            .limit(100);
        res.json(records);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch records' });
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
        const records = await WeekendWalkthrough.find({ entityId: req.user?.entityId }).populate('vehicleId').sort('-createdAt');
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
