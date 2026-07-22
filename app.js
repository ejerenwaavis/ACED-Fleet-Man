require('dotenv').config();
const express = require('express');
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
const WalkthroughTemplate = require('./models/WalkthroughTemplate');
const WalkthroughRecord = require('./models/WalkthroughRecord');
const QRCode = require('qrcode');

// 2. const app = express()
const app = express();

// --- Auth Bypass Middleware ---
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODBURI)
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

// 10. All routes (GET, POST, PATCH, DELETE)
app.get('/', (req, res) => {
    res.render('pages/index');
});

app.get('/dashboard', async (req, res) => {
    const tasks = await Task.find({ entityId: req.user?.entityId }).sort('-createdAt').limit(20);
    
    // AI Advancement: Predictive Maintenance
    const vehicles = await Vehicle.find({ status: 'active', entityId: req.user?.entityId });
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const maintenanceAlerts = vehicles.filter(v => {
        // Flag vehicles that have never had an oil change logged, or it's been over 90 days
        if (!v.lastOilChange) return true; 
        return v.lastOilChange < ninetyDaysAgo;
    });

    res.render('pages/dashboard', { tasks, maintenanceAlerts });
});

// --- Fleet Management Routes ---
app.get('/vehicles', async (req, res) => {
    const vehicles = await Vehicle.find({ entityId: req.user?.entityId }).sort('routeNumber');
    
    // AI Advancement: Generate Barcodes for each vehicle
    for (let v of vehicles) {
        const barcodeString = `V${v.truckNumber}`;
        const pngBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeString,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });
        v.qrCode = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    }
    
    res.render('pages/vehicles', { vehicles });
});

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

// --- Maintenance Routes ---
app.get('/maintenance/new', (req, res) => {
    res.render('pages/maintenance_new');
});

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
app.get('/walkthrough/new', async (req, res) => {
    const vehicles = await Vehicle.find({ status: 'active', entityId: req.user?.entityId }).sort('truckNumber');
    res.render('pages/walkthrough_new', { vehicles });
});

// AI Advancement: QR Code Quick Check-In Route
app.get('/walkthrough/quick/:id', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).send('Vehicle not found');
        res.render('pages/walkthrough_quick', { vehicle });
    } catch (err) {
        res.status(500).send('Invalid vehicle link');
    }
});

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
app.get('/walkthrough/weekend/new', async (req, res) => {
    const vehicles = await Vehicle.find({ status: 'active', entityId: req.user?.entityId }).sort('truckNumber');
    res.render('pages/weekend_walkthrough_new', { vehicles });
});

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

// --- Dynamic Template-based Walkthrough Routes ---

// GET templates list
app.get('/api/walkthrough-templates', async (req, res) => {
    try {
        const templates = await WalkthroughTemplate.find({ entityId: req.user?.entityId }).sort('name');
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/walkthrough-templates', async (req, res) => {
    try {
        const { name, items } = req.body;
        const template = new WalkthroughTemplate({ name, items, entityId: req.user?.entityId });
        await template.save();
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/walkthrough-templates/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid template id' });
        }
        const { name, items } = req.body;
        const template = await WalkthroughTemplate.findOneAndUpdate(
            { _id: req.params.id, entityId: req.user?.entityId },
            { $set: { name, items } },
            { new: true }
        );
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/walkthrough-templates/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid template id' });
        }
        const deleted = await WalkthroughTemplate.findOneAndDelete({ _id: req.params.id, entityId: req.user?.entityId });
        if (!deleted) return res.status(404).json({ error: 'Template not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/walkthrough-records', async (req, res) => {
    try {
        let { templateId, vehicleId, date, mileage, data, maintenanceNote, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(vehicleId)) {
            return res.status(400).json({ error: 'Invalid templateId or vehicleId' });
        }

        const allowedStatuses = ['draft', 'completed'];
        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        // Fetch the template once and reuse below to avoid duplicate DB calls.
        let cachedTpl = null;
        const getTemplate = async () => {
            if (!cachedTpl) {
                cachedTpl = await WalkthroughTemplate.findOne({ _id: templateId, entityId: req.user?.entityId });
            }
            return cachedTpl;
        };

        // The frontend form only sends checklist answers inside `data` (keyed by field id),
        // it does not send a top-level `mileage`. If the template has a field flagged as the
        // mileage/odometer field (or a number field labeled "mileage"/"odometer" as a fallback
        // for templates saved before that flag existed), pull the value out of `data` so it
        // actually gets recorded and can be used to update the vehicle below.
        if (mileage == null && data) {
            try {
                const tpl = await getTemplate();
                if (tpl && tpl.items) {
                    const mileageItem = tpl.items.find(i => i.isMileageField) ||
                        tpl.items.find(i => i.type === 'number' && /\b(mileage|odometer)\b/i.test(i.label || ''));
                    if (mileageItem && data[mileageItem.id] != null) {
                        mileage = data[mileageItem.id];
                    }
                }
            } catch (lookupErr) {
                console.error('Mileage field lookup failed', lookupErr);
            }
        }

        const parsedMileage = mileage != null ? Number(mileage) : undefined;
        if (parsedMileage !== undefined && isNaN(parsedMileage)) {
            return res.status(400).json({ error: 'mileage must be a valid number' });
        }

        if (status === 'draft') {
            // Upsert a draft record (one draft per vehicle+template+date)
            const startOfDay = new Date(date || Date.now());
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(startOfDay);
            endOfDay.setUTCHours(23, 59, 59, 999);

            let record = await WalkthroughRecord.findOne({
                entityId: req.user?.entityId,
                templateId,
                vehicleId,
                date: { $gte: startOfDay, $lte: endOfDay },
                status: 'draft'
            });

            if (!record) {
                record = new WalkthroughRecord({
                    entityId: req.user?.entityId,
                    templateId,
                    vehicleId,
                    date: date ? new Date(date) : new Date()
                });
            }

            if (parsedMileage !== undefined) record.mileage = parsedMileage;
            if (data !== undefined) record.data = data;
            if (maintenanceNote !== undefined) record.maintenanceNote = maintenanceNote;
            record.status = 'draft';

            await record.save();
            return res.json({ success: true, record });
        }

        // Completed submission
        const record = new WalkthroughRecord({
            entityId: req.user?.entityId,
            templateId,
            vehicleId,
            date: date ? new Date(date) : new Date(),
            mileage: parsedMileage,
            data,
            maintenanceNote,
            status: 'completed'
        });

        await record.save();

        // Persist mileage to the vehicle so Fleet Roster reflects the latest reading.
        if (parsedMileage != null) {
            try {
                const vehicle = await Vehicle.findOne({ _id: vehicleId, entityId: req.user?.entityId });
                if (vehicle) {
                    vehicle.lastKnownMileage = parsedMileage;
                    await vehicle.save();
                }
            } catch (mileageErr) {
                console.error('Failed to update vehicle mileage from walkthrough', mileageErr);
            }
        }

        // Mechanic Routing / Ticket Generation
        const failedItems = [];
        if (data) {
            const tpl = await getTemplate();
            if (tpl && tpl.items) {
                for (const item of tpl.items) {
                    if (item.type === 'boolean' && data[item.id] === false) {
                        failedItems.push(item.label);
                    }
                }
            }
        }

        if (maintenanceNote || failedItems.length > 0) {
            const vehicle = await Vehicle.findOne({ _id: vehicleId, entityId: req.user?.entityId });
            const noteLines = [];
            if (failedItems.length > 0) noteLines.push(`Failed items: ${failedItems.join(', ')}`);
            if (maintenanceNote) noteLines.push(maintenanceNote);
            await Task.create({
                entityId: req.user?.entityId,
                title: `Walkthrough Issue - ${vehicle ? vehicle.truckNumber : vehicleId}`,
                description: noteLines.join('\n'),
                category: 'walkthrough-issue',
                referenceId: record._id
            });
        }

        res.json({ success: true, record });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/walkthrough-records', async (req, res) => {
    try {
        const { templateId, vehicleId } = req.query;
        const filter = { entityId: req.user?.entityId };
        if (templateId) {
            if (!mongoose.Types.ObjectId.isValid(templateId)) return res.status(400).json({ error: 'Invalid templateId' });
            filter.templateId = templateId;
        }
        if (vehicleId) {
            if (!mongoose.Types.ObjectId.isValid(vehicleId)) return res.status(400).json({ error: 'Invalid vehicleId' });
            filter.vehicleId = vehicleId;
        }
        const records = await WalkthroughRecord.find(filter).sort('-date').limit(100);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
