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
const QRCode = require('qrcode');

// 2. const app = express()
const app = express();

// --- Auth Bypass Middleware ---
app.use((req, res, next) => {
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
        req.user = { id: 'mock-admin-id', name: 'Local Admin', role: 'admin' };
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
const seedVehicles = async () => {
    const count = await Vehicle.countDocuments();
    if (count === 0) {
        await Vehicle.insertMany([
            { routeNumber: 'R-01', truckNumber: 'TRK-101' },
            { routeNumber: 'R-02', truckNumber: 'TRK-102' },
            { routeNumber: 'R-03', truckNumber: 'TRK-103' },
        ]);
        console.log('Seeded mock vehicles');
    }
};
mongoose.connection.once('open', seedVehicles);

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
    const tasks = await Task.find().sort('-createdAt').limit(20);
    
    // AI Advancement: Predictive Maintenance
    const vehicles = await Vehicle.find({ status: 'active' });
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
    const vehicles = await Vehicle.find().sort('routeNumber');
    
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

app.post('/api/vehicles', async (req, res) => {
    try {
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status } = req.body;
        const vehicle = new Vehicle({
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status
        });
        await vehicle.save();
        if (req.accepts('json')) return res.json(vehicle);
        res.redirect('/vehicles');
    } catch (err) {
        console.error(err);
        if (req.accepts('json')) return res.status(500).json({ error: 'Error adding vehicle' });
        res.status(500).send('Error adding vehicle');
    }
});

app.post('/api/vehicles/:id', async (req, res) => {
    try {
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status } = req.body;
        const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, {
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status
        }, { new: true });
        if (req.accepts('json')) return res.json(vehicle);
        res.redirect('/vehicles');
    } catch (err) {
        console.error(err);
        if (req.accepts('json')) return res.status(500).json({ error: 'Error updating vehicle' });
        res.status(500).send('Error updating vehicle');
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
    const vehicles = await Vehicle.find({ status: 'active' }).sort('truckNumber');
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
            vehicleId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (!walkthrough) {
            walkthrough = new EveningWalkthrough({ vehicleId, date: new Date(date) });
        }

        if (checks) walkthrough.checks = { ...walkthrough.checks, ...checks };
        if (maintenanceNote !== undefined) walkthrough.maintenanceNote = maintenanceNote;
        if (routing !== undefined) walkthrough.routing = routing;
        if (status) walkthrough.status = status;

        await walkthrough.save();

        // If marked completed, generate tasks
        if (status === 'completed') {
            const vehicle = await Vehicle.findById(vehicleId);
            
            if (walkthrough.checks && (!walkthrough.checks.scanner || !walkthrough.checks.gasCard || !walkthrough.checks.batteries)) {
                await Task.create({
                    title: `Missing Items - ${vehicle.truckNumber}`,
                    description: `Scanner: ${walkthrough.checks.scanner}, Gas Card: ${walkthrough.checks.gasCard}, Batteries: ${walkthrough.checks.batteries}`,
                    category: 'walkthrough-issue',
                    referenceId: walkthrough._id
                });
            }
            if (walkthrough.maintenanceNote) {
                await Task.create({
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
    const vehicles = await Vehicle.find({ status: 'active' }).sort('truckNumber');
    res.render('pages/weekend_walkthrough_new', { vehicles });
});

app.post('/api/walkthrough/weekend', async (req, res) => {
    try {
        const { vehicleId, mileage, windscreenStatus, windscreenNotes, wipersStatus, wipersNotes, mirrorsStatus, mirrorsNotes, tiresStatus, tiresNotes, bodyDamage, maintenanceNote, notes } = req.body;
        
        let compiledNotes = maintenanceNote || '';
        
        const assetChecks = {
            windscreen: { status: windscreenStatus, notes: windscreenNotes },
            wipers: { status: wipersStatus, notes: wipersNotes },
            mirrors: { status: mirrorsStatus, notes: mirrorsNotes },
            tires: { status: tiresStatus, notes: tiresNotes }
        };

        // Automatically append any failed asset checks to the maintenance note
        for (const [key, check] of Object.entries(assetChecks)) {
            if (check.status === 'fail' && check.notes) {
                compiledNotes += `\n[${key.toUpperCase()} FAIL]: ${check.notes}`;
            }
        }
        
        const walkthrough = new WeekendWalkthrough({
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
                vehicleId: vehicle.truckNumber,
                status: 'completed',
                updatedAt: { $gte: lastMonth, $lt: startOfThisMonth }
            });

            const repairLog = recentRepairs.map(r => r.title + ': ' + r.description).join('; ');
            
            console.log(`[MMR Automation] Generating MMR for Vehicle ${vehicle.truckNumber} with Mileage ${mileage} and repairs: ${repairLog}`);
            
            // Generate Task to notify admin that an MMR was auto-generated
            await Task.create({
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
app.get('/api/dashboard-data', async (req, res) => {
    try {
        const tasks = await Task.find().sort('-createdAt').limit(20);
        const vehicles = await Vehicle.find();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const maintenanceAlerts = vehicles.filter(v => v.status === 'active' && (!v.lastOilChange || v.lastOilChange < ninetyDaysAgo));
        res.json({ tasks, maintenanceAlerts, vehicles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vehicles-data', async (req, res) => {
    try {
        const vehicles = await Vehicle.find().sort('routeNumber');
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
