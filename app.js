require('dotenv').config();
const express = require('express');
const { sendMmrEmail } = require('./services/email');
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
const ServiceRecord = require('./models/ServiceRecord');
const Vehicle = require('./models/Vehicle');
const Device = require('./models/Device');
const Task = require('./models/Task');
const ChecklistItem = require('./models/ChecklistItem');
const Entity = require('./models/Entity');
const Partnership = require('./models/Partnership');
const ActivityLog = require('./models/ActivityLog');
const Invite = require('./models/Invite');
const { sendSms } = require('./lib/smsService');
const QRCode = require('qrcode');

// 2. const app = express()
const app = express();

const isProd = process.env.NODE_ENV === 'production';
const hostUrl = process.env.HOST || 'fleetman.aceddivision.com';
const backendUrl = isProd ? `https://${hostUrl}` : 'http://localhost:3000';
const frontendUrl = isProd ? `https://${hostUrl}` : 'http://localhost:3001';

const uploadTemp = multer({ dest: 'uploads/' });

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
app.get('/api/auth/google', (req, res, next) => {
    if (req.query.state) {
        req.session.returnTo = req.query.state;
    }
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login?error=true' }),
    (req, res) => {
        const returnTo = req.session.returnTo;
        if (returnTo) {
            delete req.session.returnTo;
            return res.redirect(`${frontendUrl}${returnTo}`);
        }
        
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

app.get('/api/auth/me', async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const userWithEntity = await User.findById(req.user._id).populate('entityId');
            // send user with entity, also signatureFilename is on user
            res.json({ user: userWithEntity });
        } catch (err) {
            res.status(500).json({ error: 'Failed to populate user' });
        }
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// --- Onboarding APIs ---
app.post('/api/onboarding/create-entity', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'unassigned') return res.status(400).json({ error: 'User is already assigned to an entity' });
    
    try {
        const { entityName, entityType, description, address } = req.body;
        if (!entityName) return res.status(400).json({ error: 'Entity name required' });
        if (!entityType || !['dsp', 'msp'].includes(entityType)) return res.status(400).json({ error: 'Valid entityType (dsp or msp) required' });

        const newEntity = await Entity.create({ 
            name: entityName, 
            entityType, 
            contactEmail: req.user.email,
            description,
            address 
        });
        
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

const isMspTeamMember = (req, res, next) => {
    if (req.isAuthenticated()) {
        if (req.user.role === 'manager' || req.user.role === 'admin' || req.user.role === 'mechanic') {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    res.status(401).json({ error: 'Unauthorized' });
};

// --- Invite APIs ---
app.post('/api/invites/generate', isAuthenticated, async (req, res) => {
    // Only admins or managers can generate invites
    if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    try {
        const { role, phone } = req.body;
        if (!['admin', 'manager', 'driver', 'mechanic'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }
        
        const invite = await Invite.create({
            senderId: req.user._id,
            entityId: req.user.entityId,
            role
        });
        
        const baseUrl = req.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteLink = `${baseUrl}/join?token=${invite.token}`;
        
        // If a phone number was provided, send an SMS via our mock service
        if (phone) {
            const entity = await Entity.findById(req.user.entityId);
            const message = `You've been invited to join ${entity.name} on Fleetman as a ${role}. Click here to join: ${inviteLink}`;
            await sendSms(phone, message);
        }
        
        res.json({ success: true, inviteLink, token: invite.token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invites/validate/:token', isAuthenticated, async (req, res) => {
    try {
        const invite = await Invite.findOne({ token: req.params.token, status: 'pending' }).populate('entityId');
        
        if (!invite || invite.isExpired()) {
            return res.status(400).json({ error: 'Invite link is invalid or expired.' });
        }
        
        if (req.user.entityId) {
            return res.status(400).json({ error: 'You are already part of an organization.' });
        }
        
        // Claim the invite
        req.user.entityId = invite.entityId._id;
        req.user.role = invite.role;
        await req.user.save();
        
        invite.status = 'accepted';
        invite.claimedBy = req.user._id;
        await invite.save();
        
        res.json({ success: true, entity: invite.entityId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invites/:token', async (req, res) => {
    try {
        const invite = await Invite.findOne({ token: req.params.token, status: 'pending' }).populate('entityId', 'name');
        
        if (!invite || invite.isExpired()) {
            return res.status(404).json({ error: 'Invite not found or expired' });
        }
        
        res.json({
            entityName: invite.entityId.name,
            role: invite.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Public APIs ---
app.get('/api/public/entity/:slug', async (req, res) => {
    try {
        const entity = await Entity.findOne({ publicSlug: req.params.slug, publicProfileEnabled: true });
        if (!entity) return res.status(404).json({ error: 'Public profile not found or disabled.' });
        
        // Strip sensitive info
        res.json({
            _id: entity._id,
            name: entity.name,
            entityType: entity.entityType,
            description: entity.description,
            address: entity.address,
            specialties: entity.specialties,
            workingHours: entity.workingHours
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/vehicles/:id', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id).populate('entityId', 'name');
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        // Strip sensitive info (only basic public info)
        res.json({
            _id: vehicle._id,
            truckNumber: vehicle.truckNumber,
            vin: vehicle.vin ? `***${vehicle.vin.slice(-4)}` : 'N/A', // Mask VIN
            dotInspectionExpiry: vehicle.dotInspectionExpiry,
            registrationExpiry: vehicle.registrationExpiry,
            entityName: vehicle.entityId ? vehicle.entityId.name : 'Unknown Entity'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- Mechanic APIs ---
app.get('/api/mechanic/settings', isAuthenticated, async (req, res) => {
    try {
        const entity = await Entity.findById(req.user.entityId);
        res.json(entity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mechanic/settings', isAuthenticated, async (req, res) => {
    try {
        const { autoAcceptRules, standardHourlyRate, workingHours, listedInDirectory, description, contactEmail, contactPhone, specialties, serviceRadius } = req.body;
        const updates = { autoAcceptRules, standardHourlyRate, workingHours, listedInDirectory, description, contactEmail, contactPhone, specialties, serviceRadius };
        
        // Remove undefined fields to not overwrite with nulls accidentally
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        
        const entity = await Entity.findByIdAndUpdate(req.user.entityId, updates, { new: true });
        res.json(entity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Partnership APIs ---
app.get('/api/msp/directory', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const msps = await Entity.find({ entityType: 'msp', listedInDirectory: true })
            .select('name description contactEmail contactPhone specialties serviceRadius isVerified').lean();
            
        const partnerships = await Partnership.find({ dspEntityId: req.user.entityId });
        const pMap = {};
        partnerships.forEach(p => pMap[p.mspEntityId.toString()] = p.status);
        
        const result = msps.map(msp => ({
            ...msp,
            partnershipStatus: pMap[msp._id.toString()] || null
        }));
        
        res.json(result);
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
            initiatedBy: myEntityId,
            terms: req.body.terms
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
        const { status, terms, defaultAutoAssign, autoApproveSupplementalRequests } = req.body;
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
        if (autoApproveSupplementalRequests !== undefined && req.user.entityId.toString() === p.dspEntityId.toString()) {
            p.autoApproveSupplementalRequests = autoApproveSupplementalRequests;
        }

        await p.save();
        res.json({ success: true, partnership: p });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MSP Jobs APIs ---
app.get('/api/msp/jobs', isAuthenticated, isMspTeamMember, async (req, res) => {
    try {
        const query = { 
            assignedMspEntityId: req.user.entityId,
            isInternal: { $ne: true },
            visibility: { $ne: 'internal' } // Fallback for older tickets
        };

        // If the user is a mechanic, they should not see other mechanics' claimed jobs
        if (req.user.role === 'mechanic') {
            query.$or = [
                { assignedMechanicId: null },
                { assignedMechanicId: { $exists: false } },
                { assignedMechanicId: req.user._id }
            ];
        }

        const jobs = await MaintenanceRequest.find(query)
            .populate('entityId', 'name contactEmail contactPhone') // The DSP
            .populate('assignedMechanicId', 'name')
            .sort('-createdAt');
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/msp/jobs/:id/status', isAuthenticated, isMspTeamMember, uploadTemp.array('mechanicAttachments', 5), async (req, res) => {
    try {
        const { status, mechanicNotes, laborHours, laborRate } = req.body;
        const job = await MaintenanceRequest.findOne({ 
            _id: req.params.id, 
            assignedMspEntityId: req.user.entityId 
        });

        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Enforce claim lock
        if (job.assignedMechanicId && job.assignedMechanicId.toString() !== req.user._id.toString() && req.user.role === 'mechanic') {
            return res.status(403).json({ error: 'Job is claimed by another mechanic' });
        }

        const oldStatus = job.status;
        job.status = status;
        
        if (mechanicNotes !== undefined) job.mechanicNotes = mechanicNotes;
        if (laborHours !== undefined && laborHours !== "") job.laborHours = Number(laborHours);
        if (laborRate !== undefined && laborRate !== "") job.laborRate = Number(laborRate);

        if (status === 'accepted' && oldStatus !== 'accepted') {
            job.acceptedAt = new Date();
            if (!job.assignedMechanicId) job.assignedMechanicId = req.user._id;
        }
        if (status === 'completed' && oldStatus !== 'completed') job.completedAt = new Date();

        if (req.files && Array.isArray(req.files)) {
            let photoUrls = [];
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'fleetMan'
                    });
                    photoUrls.push(result.secure_url);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed:", uploadErr);
                } finally {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
            if (photoUrls.length > 0) {
                job.mechanicAttachments = [...(job.mechanicAttachments || []), ...photoUrls];
            }
        }

        await job.save();

        // Log the activity
        await ActivityLog.create({
            jobId: job._id,
            actorId: req.user._id,
            actorEntityId: req.user.entityId,
            action: 'status_change',
            fromValue: oldStatus,
            toValue: status
        });

        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/msp/jobs/:id/reassign', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const { assignedMechanicId } = req.body;
        const job = await MaintenanceRequest.findOne({ 
            _id: req.params.id, 
            assignedMspEntityId: req.user.entityId 
        });

        if (!job) return res.status(404).json({ error: 'Job not found' });

        const oldMechanicId = job.assignedMechanicId;
        job.assignedMechanicId = assignedMechanicId || null;
        await job.save();

        await ActivityLog.create({
            jobId: job._id,
            actorId: req.user._id,
            actorEntityId: req.user.entityId,
            action: 'reassign_mechanic',
            fromValue: oldMechanicId ? oldMechanicId.toString() : 'unassigned',
            toValue: assignedMechanicId || 'unassigned'
        });

        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/msp/jobs/initiate', isAuthenticated, uploadTemp.array('mechanicAttachments', 5), async (req, res) => {
    try {
        const { vehicleId, title, description, parentRequestId, category } = req.body;
        
        // Find vehicle to get fleet entityId
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        const dspEntityId = vehicle.entityId;
        const mspEntityId = req.user.entityId;
        
        // Find partnership
        const Partnership = require('./models/Partnership');
        const partnership = await Partnership.findOne({ dspEntityId, mspEntityId, status: 'active' });
        if (!partnership) return res.status(403).json({ error: 'No active partnership with this fleet' });

        const isAutoApprove = partnership.autoApproveSupplementalRequests === true;
        
        // Upload attachments
        let photoUrls = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'fleetMan' });
                    photoUrls.push(result.secure_url);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed:", uploadErr);
                } finally {
                    const fs = require('fs');
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
        }

        const newRequest = new MaintenanceRequest({
            entityId: dspEntityId,
            title,
            description,
            requestType: 'Vehicle Issue',
            vehicleId,
            reportedBy: req.user._id,
            status: isAutoApprove ? 'in-progress' : 'pending',
            assignedMspEntityId: mspEntityId,
            assignedMechanicId: req.user._id,
            mechanicAttachments: photoUrls,
            initiatedByMechanic: true,
            approvalStatus: isAutoApprove ? 'auto_approved' : 'pending_admin_approval',
            parentRequestId: parentRequestId || undefined,
            category: category || undefined
        });

        await newRequest.save();
        res.json({ success: true, request: newRequest });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Connect to MongoDB
console.error(`[${new Date().toISOString()}] === STARTUP SEQUENCE INITIATED ===`);
console.error(`[${new Date().toISOString()}] Attempting to connect to MongoDB. process.env.MONGODB_URI is: ${process.env.MONGODB_URI ? 'SET (Value Hidden)' : 'UNDEFINED'}`);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.error(`[${new Date().toISOString()}] SUCCESSFULLY CONNECTED TO MONGODB!`))
    .catch((err) => console.error(`[${new Date().toISOString()}] FATAL MONGODB CONNECTION ERROR:`, err));

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

// Serve signatures statically
app.use('/signatures', express.static(signaturesDir));

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

app.post('/api/user/signature', isAuthenticated, uploadSignature.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `user_${req.user._id}_${Date.now()}${ext}`;
    const targetPath = path.join(signaturesDir, filename);
    
    fs.renameSync(req.file.path, targetPath);

    // Save to user
    await User.findByIdAndUpdate(req.user._id, { signatureFilename: filename });
    
    res.json({ success: true, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { signatureFilename, applySignature, ...recordData } = req.body;
    const record = validateRecord(recordData);
    
    // Automatically use user's saved signature if applySignature is true and no specific file provided
    let finalSigFilename = signatureFilename;
    if (!finalSigFilename && applySignature) {
       const user = await User.findById(req.user._id);
       if (user && user.signatureFilename) {
           finalSigFilename = user.signatureFilename;
       }
    }

    const dateCompleted = getDateCompleted(record.recordMonth, mmrConfig.dateCompletedStrategy);
    const monthLabel = formatRecordMonthLabel(record.recordMonth);
    const sigPath = finalSigFilename ? path.join(signaturesDir, finalSigFilename) : null;
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
    let signatureFilename = req.body.signatureFilename;
    const applySignature = req.body.applySignature === 'true';
    const companyName = req.body.companyName;
    const domicile = req.body.domicile;
    
    // Automatically use user's saved signature if applySignature is true and no specific file provided
    if (!signatureFilename && applySignature) {
       const user = await User.findById(req.user._id);
       if (user && user.signatureFilename) {
           signatureFilename = user.signatureFilename;
       }
    }
    const sigPath = signatureFilename ? path.join(signaturesDir, signatureFilename) : null;

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    let records;
    if (req.file.originalname.toLowerCase().endsWith('.json')) {
      const parsedJson = JSON.parse(fileContent);
      const dataArray = Array.isArray(parsedJson) ? parsedJson : (parsedJson.vehicles || []);
      records = dataArray.map(r => validateRecord(r));
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

app.post('/api/vehicles/ocr', uploadTemp.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fs = require('fs');
        const filePath = req.file.path;
        
        let vin = '';
        let licensePlate = '';
        let expiry = '';
        let dotExpiry = '';
        let fallbackUsed = false;
        
        // Try OpenAI first if API key is present
        const openAiKey = process.env.OPEN_AI_API;
        let openAiSuccess = false;
        
        if (openAiKey) {
            try {
                const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });
                const mimeType = req.file.mimetype || 'image/jpeg';
                
                // Using dynamic import for node-fetch if global fetch is not available (Node < 18), but Node 18+ has fetch.
                // Assuming Node 18+ because Next.js 14 requires it.
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openAiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Extract the VIN, License Plate, Registration Expiry Date, and DOT Inspection Expiry Date from this vehicle document. Return ONLY a valid JSON object with keys "vin", "licensePlate", "expiry", and "dotExpiry". Format expiry dates as YYYY-MM-DD. If a field is not found, leave it as an empty string.' },
                                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                                ]
                            }
                        ],
                        response_format: { type: "json_object" },
                        max_tokens: 300
                    })
                });
                
                if (response.ok) {
                    const jsonRes = await response.json();
                    const resultText = jsonRes.choices[0].message.content;
                    const parsed = JSON.parse(resultText);
                    vin = parsed.vin || '';
                    licensePlate = parsed.licensePlate || '';
                    expiry = parsed.expiry || '';
                    dotExpiry = parsed.dotExpiry || '';
                    openAiSuccess = true;
                } else {
                    console.error('OpenAI Error:', await response.text());
                }
            } catch (openAiErr) {
                console.error('OpenAI Exception:', openAiErr);
            }
        }
        
        // Fallback to Tesseract
        if (!openAiSuccess) {
            fallbackUsed = true;
            const Tesseract = require('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
            
            const vinMatch = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
            if (vinMatch) vin = vinMatch[0].toUpperCase();

            const dateMatches = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g);
            if (dateMatches) {
                // Heuristics: pick the latest date found
                const dates = dateMatches.map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
                if (dates.length > 0) {
                    dates.sort((a, b) => b - a);
                    expiry = dates[0].toISOString().split('T')[0];
                    if (dates.length > 1) {
                        dotExpiry = dates[1].toISOString().split('T')[0];
                    }
                }
            }

            const plateRegex = /(?:PLATE|LIC|LIC NO|LIC\.?|TAG)[^\w]*([A-Z0-9]{2,8})/i;
            const plateMatch = text.match(plateRegex);
            if (plateMatch && plateMatch[1]) {
                licensePlate = plateMatch[1].toUpperCase();
            }
        }

        fs.unlinkSync(filePath);
        res.json({ vin, licensePlate, expiry, dotExpiry, fallbackUsed });
    } catch (err) {
        if (req.file && require('fs').existsSync(req.file.path)) {
            require('fs').unlinkSync(req.file.path);
        }
        console.error('OCR Error:', err);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

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
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status, registrationExpiry, dotExpiry } = req.body;
        
        const vehicleData = {
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status,
            entityId: req.user?.entityId
        };

        if (registrationExpiry) {
            const parsedRegDate = new Date(Array.isArray(registrationExpiry) ? registrationExpiry[0] : registrationExpiry);
            if (!isNaN(parsedRegDate)) vehicleData.registrationExpiry = parsedRegDate;
        }
        if (dotExpiry) {
            const parsedDotDate = new Date(Array.isArray(dotExpiry) ? dotExpiry[0] : dotExpiry);
            if (!isNaN(parsedDotDate)) vehicleData.dotExpiry = parsedDotDate;
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
        const { truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status, registrationExpiry, dotExpiry, lastKnownMileage } = req.body;
        
        const vehicleData = {
            truckNumber, routeNumber, makeModel, licensePlate, vin, fuelType, status,
            entityId: req.user?.entityId
        };

        if (registrationExpiry) {
            const parsedRegDate = new Date(Array.isArray(registrationExpiry) ? registrationExpiry[0] : registrationExpiry);
            if (!isNaN(parsedRegDate)) vehicleData.registrationExpiry = parsedRegDate;
        }
        if (dotExpiry) {
            const parsedDotDate = new Date(Array.isArray(dotExpiry) ? dotExpiry[0] : dotExpiry);
            if (!isNaN(parsedDotDate)) vehicleData.dotExpiry = parsedDotDate;
        }
        if (lastKnownMileage !== undefined && lastKnownMileage !== '') {
            vehicleData.lastKnownMileage = Number(lastKnownMileage);
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
        if (req.accepts('json')) return res.status(500).json({ error: err.message || 'Error updating vehicle' });
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

app.get('/api/vehicles/:id/qrcode', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        // QR Code points to the public/semi-public truck profile page
        const truckUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/truck/${vehicle._id}`;
        
        const pngBuffer = await QRCode.toBuffer(truckUrl, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 400
        });
        
        res.set('Content-Type', 'image/png');
        res.send(pngBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// --- Maintenance Routes ---

app.get('/api/fleet/maintenance', isAuthenticated, async (req, res) => {
    try {
        const requests = await MaintenanceRequest.find({ entityId: req.user.entityId })
            .populate('assignedMspEntityId', 'name contactEmail')
            .populate('vehicleId')
            .sort('-createdAt');
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dsp/active-msps', isAuthenticated, async (req, res) => {
    try {
        const partnerships = await Partnership.find({ 
            dspEntityId: req.user.entityId, 
            status: 'active' 
        }).populate('mspEntityId', 'name');
        res.json(partnerships);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/maintenance/:id/approve', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const reqId = req.params.id;
        const maintenanceReq = await MaintenanceRequest.findOne({ _id: reqId, entityId: req.user.entityId });
        if (!maintenanceReq) return res.status(404).json({ error: 'Request not found' });
        
        if (maintenanceReq.approvalStatus !== 'pending_admin_approval') {
            return res.status(400).json({ error: 'Request is not pending approval' });
        }

        maintenanceReq.approvalStatus = 'approved';
        maintenanceReq.status = 'in-progress';
        await maintenanceReq.save();
        
        // Log the activity
        const ActivityLog = require('./models/ActivityLog');
        await ActivityLog.create({
            jobId: maintenanceReq._id,
            actorId: req.user._id,
            actorEntityId: req.user.entityId,
            action: 'approval_granted'
        });

        res.json({ success: true, request: maintenanceReq });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/maintenance/:id/cancel', isAuthenticated, async (req, res) => {
    try {
        const reqId = req.params.id;
        const maintenanceReq = await MaintenanceRequest.findById(reqId);
        
        if (!maintenanceReq) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        // Ensure user is an admin or manager
        if (!['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only managers or admins can cancel requests' });
        }

        // Ensure only the DSP who created it can cancel it
        if (maintenanceReq.entityId.toString() !== req.user.entityId.toString()) {
            return res.status(403).json({ error: 'Unauthorized to cancel this request' });
        }

        // Only allow cancellation if it is pending or assigned
        if (!['pending', 'assigned'].includes(maintenanceReq.status)) {
            return res.status(400).json({ error: 'Cannot cancel a request that is already in progress or completed' });
        }

        maintenanceReq.status = 'cancelled';
        await maintenanceReq.save();
        
        await ActivityLog.create({
            jobId: maintenanceReq._id,
            actorId: req.user._id,
            actorEntityId: req.user.entityId,
            action: 'request_cancelled',
            description: 'Request was cancelled by the fleet manager'
        });

        res.json(maintenanceReq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/maintenance', isAuthenticated, uploadTemp.array('attachments', 5), async (req, res) => {
    try {
        const { title, description, vehicleId, priority, assignedMspEntityId, requestType, location } = req.body;
        let photoUrls = [];

        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'fleetMan'
                    });
                    photoUrls.push(result.secure_url);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed:", uploadErr);
                    // Continue without the photo, or you could return a 400 error here.
                } finally {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path); // Clean up temp file
                }
            }
        }

        let finalMspId = assignedMspEntityId;
        if (!finalMspId) {
            const autoPartnership = await Partnership.findOne({
                dspEntityId: req.user?.entityId,
                status: 'active',
                defaultAutoAssign: true
            });
            if (autoPartnership) {
                finalMspId = autoPartnership.mspEntityId;
            }
        }

        const newRequest = new MaintenanceRequest({
            entityId: req.user?.entityId,
            title,
            description,
            requestType: requestType || 'Vehicle Issue',
            vehicleId: (vehicleId && vehicleId.trim() !== '') ? vehicleId : undefined,
            location: location || null,
            priority,
            attachments: photoUrls,
            assignedMspEntityId: finalMspId || undefined,
            status: finalMspId ? 'assigned' : 'pending'
        });
        await newRequest.save();

        if (finalMspId) {
            await ActivityLog.create({
                jobId: newRequest._id,
                actorId: req.user._id,
                actorEntityId: req.user.entityId,
                action: 'status_change',
                fromValue: 'pending',
                toValue: 'assigned'
            });
        }

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

app.patch('/api/maintenance/:id', isAuthenticated, uploadTemp.array('attachments', 5), async (req, res) => {
    try {
        const { title, description, vehicleId, priority, requestType, location, category, isInternal, assignedMspEntityId } = req.body;
        const job = await MaintenanceRequest.findOne({ 
            _id: req.params.id, 
            entityId: req.user.entityId 
        });

        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Once accepted, DSP can no longer edit core fields
        const isLocked = ['accepted', 'in-progress', 'awaiting-parts', 'completed', 'invoiced', 'closed'].includes(job.status);
        
        if (!isLocked) {
            if (title !== undefined) job.title = title;
            if (description !== undefined) job.description = description;
            if (vehicleId !== undefined) job.vehicleId = vehicleId;
            if (priority !== undefined) job.priority = priority;
            if (requestType !== undefined) job.requestType = requestType;
            if (location !== undefined) job.location = location;
            if (category !== undefined) job.category = category;
            if (assignedMspEntityId !== undefined) {
                job.assignedMspEntityId = assignedMspEntityId || null;
                if (assignedMspEntityId) {
                    job.status = 'assigned';
                } else {
                    job.status = 'pending';
                }
            }
        }

        // isInternal can be updated to false (sending to network)
        if (isInternal === false || isInternal === 'false') {
            job.isInternal = false;
        }

        // Attachments can always be added
        if (req.files && Array.isArray(req.files)) {
            let photoUrls = [];
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: 'fleetMan' });
                    photoUrls.push(result.secure_url);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed:", uploadErr);
                } finally {
                    const fs = require('fs');
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
            if (photoUrls.length > 0) {
                job.attachments = [...(job.attachments || []), ...photoUrls];
            }
        }

        await job.save();
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        const { _id, name, frequency, description, items, deviceTypes, isActive } = req.body;
        
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
        let { templateId, vehicleId, date, mileage, data, maintenanceNote, status } = req.body;

        // The frontend form only sends checklist answers inside `data` (keyed by field id),
        // it does not send a top-level `mileage`. If the template has a field flagged as the
        // mileage/odometer field (or a number field labeled "mileage"/"odometer" as a fallback
        // for templates saved before that flag existed), pull the value out of `data` so it
        // actually gets recorded and can be used to update the vehicle below.
        if (!mileage && data && templateId) {
            try {
                const tpl = await WalkthroughTemplate.findById(templateId);
                if (tpl && tpl.items) {
                    const mileageItem = tpl.items.find(i => i.isMileageField) ||
                        tpl.items.find(i => i.type === 'number' && /mileage|odometer/i.test(i.label || ''));
                    if (mileageItem && data[mileageItem.id]) {
                        mileage = data[mileageItem.id];
                    }
                }
            } catch (lookupErr) {
                console.error('Mileage field lookup failed', lookupErr);
            }
        }
        
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
        
        // Mileage Discrepancy Engine
        if (status === 'completed' || !status) {
            if (mileage) {
                const lastRecord = await WalkthroughRecord.findOne({
                    vehicleId,
                    status: 'completed'
                }).sort('-date');
                
                if (lastRecord && lastRecord.mileage) {
                    if (mileage < lastRecord.mileage) {
                        maintenanceNote = (maintenanceNote ? maintenanceNote + '\n\n' : '') + 
                            `[SYSTEM FLAG] Odometer discrepancy: New mileage (${mileage}) is lower than previous (${lastRecord.mileage}).`;
                    }
                }
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

        // Persist mileage to the vehicle so Fleet Roster reflects the latest reading.
        if (record.status === 'completed' && mileage) {
            try {
                const vehicleForMileage = await Vehicle.findById(vehicleId);
                if (vehicleForMileage) {
                    vehicleForMileage.lastKnownMileage = Number(mileage);
                    await vehicleForMileage.save();
                }
            } catch (mileageErr) {
                console.error('Failed to update vehicle mileage from walkthrough', mileageErr);
            }
        }

        // Mechanic Routing / Ticket Generation
        if (record.status === 'completed') {
            const failedItems = [];
            if (data) {
                for (const [key, value] of Object.entries(data)) {
                    if (value === 'fail') {
                        failedItems.push(key.replace(/_/g, ' '));
                    }
                }
            }
            
            if (failedItems.length > 0 || maintenanceNote) {
                const openRequest = await MaintenanceRequest.findOne({
                    vehicleId,
                    status: { $in: ['pending', 'assigned', 'accepted', 'in-progress', 'awaiting-parts'] }
                });
                
                if (!openRequest) {
                    let desc = '';
                    if (failedItems.length > 0) desc += `Failed walkthrough checks: ${failedItems.join(', ')}.\n`;
                    if (maintenanceNote) desc += `Driver Note: ${maintenanceNote}`;
                    
                    const newRequest = new MaintenanceRequest({
                        entityId: req.user?.entityId,
                        title: `Auto-generated from Walkthrough (${new Date(record.date).toLocaleDateString()})`,
                        description: desc,
                        requestType: 'Vehicle Issue',
                        vehicleId,
                        reportedBy: req.user?._id,
                        visibility: 'internal',
                        isInternal: true,
                        status: 'pending',
                        priority: 'medium'
                    });
                    await newRequest.save();
                }
            }
        }

        res.json(record);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit walkthrough' });
    }
});

app.post('/api/walkthrough-records/submit-all', async (req, res) => {
    try {
        const { templateId } = req.body;
        if (!templateId) return res.status(400).json({ error: 'Missing templateId' });

        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        // Delete any extremely old, abandoned drafts to prevent them from ever being submitted accidentally
        await WalkthroughRecord.deleteMany({
            entityId: req.user?.entityId,
            templateId,
            reporterId: req.user?._id,
            status: 'draft',
            date: { $lt: twelveHoursAgo }
        });

        // Only submit drafts updated in the last 12 hours (the active session)
        const drafts = await WalkthroughRecord.find({
            entityId: req.user?.entityId,
            templateId,
            reporterId: req.user?._id,
            status: 'draft',
            date: { $gte: twelveHoursAgo }
        });

        const completedRecords = await Promise.all(drafts.map(async (record) => {
            // Mileage Discrepancy Engine
            let mileage = record.mileage;
            let maintenanceNote = record.maintenanceNote || '';

            if (mileage) {
                const lastRecord = await WalkthroughRecord.findOne({
                    vehicleId: record.vehicleId,
                    status: 'completed'
                }).sort('-date');
                
                if (lastRecord && lastRecord.mileage) {
                    if (mileage < lastRecord.mileage) {
                        maintenanceNote = (maintenanceNote ? maintenanceNote + '\n\n' : '') + 
                            `[SYSTEM FLAG] Odometer discrepancy: New mileage (${mileage}) is lower than previous (${lastRecord.mileage}).`;
                    }
                }
            }

            record.maintenanceNote = maintenanceNote;
            record.status = 'completed';
            record.date = new Date();
            await record.save();

            // Persist mileage to the vehicle
            if (mileage) {
                try {
                    const vehicleForMileage = await Vehicle.findById(record.vehicleId);
                    if (vehicleForMileage) {
                        vehicleForMileage.lastKnownMileage = Number(mileage);
                        await vehicleForMileage.save();
                    }
                } catch (mileageErr) {
                    console.error('Failed to update vehicle mileage from walkthrough', mileageErr);
                }
            }

            // Mechanic Routing / Ticket Generation
            const failedItems = [];
            if (record.data) {
                for (const [key, value] of Object.entries(record.data)) {
                    if (value === 'fail') {
                        failedItems.push(key.replace(/_/g, ' '));
                    }
                }
            }
            
            if (failedItems.length > 0 || maintenanceNote) {
                const openRequest = await MaintenanceRequest.findOne({
                    vehicleId: record.vehicleId,
                    status: { $in: ['pending', 'assigned', 'accepted', 'in-progress', 'awaiting-parts'] }
                });
                
                if (!openRequest) {
                    let desc = '';
                    if (failedItems.length > 0) desc += `Failed walkthrough checks: ${failedItems.join(', ')}.\n`;
                    if (maintenanceNote) desc += `Driver Note: ${maintenanceNote}`;
                    
                    const newRequest = new MaintenanceRequest({
                        entityId: req.user?.entityId,
                        title: `Auto-generated from Walkthrough (${new Date(record.date).toLocaleDateString()})`,
                        description: desc,
                        requestType: 'Vehicle Issue',
                        vehicleId: record.vehicleId,
                        reportedBy: req.user?._id,
                        status: 'pending',
                        priority: 'medium',
                        visibility: 'internal',
                        isInternal: true
                    });
                    await newRequest.save();
                }
            }

            return record;
        }));

        res.json({ message: 'Submitted all drafts', count: completedRecords.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit all walkthroughs' });
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

// Get walkthrough records for a specific vehicle
app.get('/api/vehicles/:id/walkthroughs', async (req, res) => {
    try {
        const records = await WalkthroughRecord.find({ 
            entityId: req.user?.entityId, 
            vehicleId: req.params.id,
            status: 'completed'
        })
            .populate('templateId', 'name')
            .populate('reporterId', 'displayName email')
            .sort('-date')
            .limit(50);
        res.json(records);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch vehicle walkthroughs' });
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
        if (vehicle && mileage) {
            vehicle.lastKnownMileage = Number(mileage);
            await vehicle.save();
        }

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
                vehicleId: vehicle._id,
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


// --- Service Records API ---
app.post('/api/vehicles/:id/service-records', isAuthenticated, async (req, res) => {
    try {
        const { date, maintenanceType, details, performedBy, mileageAtService } = req.body;
        
        const vehicle = await Vehicle.findOne({ _id: req.params.id, entityId: req.user.entityId });
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

        const record = new ServiceRecord({
            entityId: req.user.entityId,
            vehicleId: vehicle._id,
            date,
            maintenanceType,
            details,
            performedBy,
            mileageAtService,
            loggedByUserId: req.user._id
        });
        
        await record.save();
        res.json(record);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vehicles/:id/service-records', isAuthenticated, async (req, res) => {
    try {
        const records = await ServiceRecord.find({
            entityId: req.user.entityId,
            vehicleId: req.params.id
        }).sort({ date: -1 });
        
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

app.get('/api/export/bulk-backup', isAuthenticated, isManagerOrAdmin, async (req, res) => {
    try {
        const entityId = req.user.entityId;

        // Fetch data
        const vehicles = await Vehicle.find({ entityId }).lean();
        const devices = await Device.find({ entityId }).lean();
        const walkthroughs = await WalkthroughRecord.find({ entityId })
            .populate('vehicleId', 'truckNumber')
            .populate('reporterId', 'displayName email')
            .lean();
        const maintenance = await MaintenanceRequest.find({ entityId })
            .populate('reportedBy', 'displayName email')
            .lean();
        const users = await User.find({ entityId }).lean();

        // Helper to convert array of objects to CSV
        const toCsv = (data) => {
            if (!data || !data.length) return '';
            
            // Get all unique keys
            const keys = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));
            
            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const header = keys.map(escapeCsv).join(',');
            const rows = data.map(row => keys.map(k => escapeCsv(row[k])).join(','));
            return [header, ...rows].join('\n');
        };

        const archive = new ZipArchive({ zlib: { level: 9 } });

        res.attachment(`aced_fleet_backup_${new Date().toISOString().split('T')[0]}.zip`);
        
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).end();
        });

        archive.pipe(res);

        archive.append(toCsv(vehicles), { name: 'vehicles.csv' });
        archive.append(toCsv(devices), { name: 'devices.csv' });
        
        // Flatten nested populate fields before CSV
        const flatWalkthroughs = walkthroughs.map(w => ({
            ...w,
            vehicleId: w.vehicleId?.truckNumber || w.vehicleId,
            reporterId: w.reporterId?.displayName || w.reporterId?.email || w.reporterId
        }));
        archive.append(toCsv(flatWalkthroughs), { name: 'walkthroughs.csv' });
        
        const flatMaintenance = maintenance.map(m => ({
            ...m,
            reportedBy: m.reportedBy?.displayName || m.reportedBy?.email || m.reportedBy
        }));
        archive.append(toCsv(flatMaintenance), { name: 'maintenance.csv' });
        
        archive.append(toCsv(users), { name: 'users.csv' });

        await archive.finalize();

    } catch (err) {
        console.error('Bulk Export Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate export archive' });
        }
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
        const vehicles = await Vehicle.find({ entityId: req.user?.entityId })
            .collation({ locale: 'en_US', numericOrdering: true })
            .sort('truckNumber')
            .lean();
            
        const devices = await Device.find({ entityId: req.user?.entityId, status: 'Assigned' }).lean();
        
        const vehiclesWithDevices = vehicles.map(v => {
            v.devices = devices.filter(d => d.assignedVehicle === v.truckNumber);
            return v;
        });

        res.json(vehiclesWithDevices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auto-mmr-data', async (req, res) => {
    try {
        const { month } = req.query; // e.g. "2023-10"
        if (!month) return res.status(400).json({ error: 'Month is required' });

        const [year, m] = month.split('-');
        const startOfMonth = new Date(parseInt(year), parseInt(m) - 1, 1);
        const endOfMonth = new Date(parseInt(year), parseInt(m), 1);

        const vehicles = await Vehicle.find({ 
            entityId: req.user?.entityId, 
            status: { $in: ['Active', 'In shop'] } 
        }).collation({ locale: 'en_US', numericOrdering: true }).sort('truckNumber');

        const data = await Promise.all(vehicles.map(async (v) => {
            const maintenanceRecords = await MaintenanceRequest.find({
                entityId: req.user?.entityId,
                vehicleId: v._id,
                status: { $in: ['completed', 'closed'] },
                updatedAt: { $gte: startOfMonth, $lt: endOfMonth }
            });

            // Find first and last walkthrough for the month to get mileage
            const monthWalkthroughs = await WalkthroughRecord.find({
                entityId: req.user?.entityId,
                vehicleId: v._id,
                status: 'completed',
                date: { $gte: startOfMonth, $lt: endOfMonth }
            }).sort('date');

            let monthMileage = v.lastKnownMileage || '';
            if (monthWalkthroughs.length > 0) {
                // If we want exact starting and ending we could use them, but MMR uses just 'mileage' 
                // typically representing the end of month mileage
                const lastW = monthWalkthroughs[monthWalkthroughs.length - 1];
                if (lastW.mileage) monthMileage = lastW.mileage;
            }

            const tasks = await Task.find({
                entityId: req.user?.entityId,
                title: new RegExp(`.*${v.truckNumber}.*`, 'i'),
                category: 'maintenance',
                status: 'completed',
                updatedAt: { $gte: startOfMonth, $lt: endOfMonth }
            });

            let combinedNotes = [];
            maintenanceRecords.forEach(r => combinedNotes.push(`${r.title}: ${r.description}`));
            tasks.forEach(t => combinedNotes.push(t.description));

            return {
                id: v._id,
                unit: v.truckNumber,
                mileage: monthMileage,
                maintenancePerformed: combinedNotes.length > 0 ? 'true' : 'false',
                outOfService: v.status === 'In shop' ? 'true' : 'false',
                maintenanceNotes: combinedNotes.join('; ')
            };
        }));

        res.json(data);
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

// --- Invoice APIs ---
app.get('/api/invoices', isAuthenticated, async (req, res) => {
    try {
        const myEntityId = req.user.entityId;
        const myEntity = await Entity.findById(myEntityId);
        
        let query = {};
        if (myEntity.entityType === 'dsp') query.dspEntityId = myEntityId;
        else query.mspEntityId = myEntityId;

        const invoices = await Invoice.find(query)
            .populate('dspEntityId', 'name contactEmail')
            .populate('mspEntityId', 'name contactEmail')
            .populate('maintenanceRequestId', 'title');
            
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices', isAuthenticated, async (req, res) => {
    try {
        const { maintenanceRequestId, amount, dueDate } = req.body;
        const maintenanceReq = await MaintenanceRequest.findById(maintenanceRequestId);
        if (!maintenanceReq) return res.status(404).json({ error: 'Request not found' });
        
        const invoice = await Invoice.create({
            dspEntityId: maintenanceReq.entityId,
            mspEntityId: req.user.entityId,
            maintenanceRequestId,
            amount,
            dueDate
        });
        
        maintenanceReq.invoiceId = invoice._id;
        maintenanceReq.status = 'invoiced';
        await maintenanceReq.save();
        
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices/:id/pay', isAuthenticated, async (req, res) => {
    try {
        const invoice = await Invoice.findByIdAndUpdate(req.params.id, {
            status: 'paid',
            paidAt: new Date()
        }, { new: true });
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/check-overdue-invoices', isAuthenticated, async (req, res) => {
    // Mock cron endpoint for checking overdue invoices
    try {
        const overdueInvoices = await Invoice.find({
            status: 'pending',
            dueDate: { $lt: new Date() }
        });
        
        // Very basic mock logic: increment strikes for every overdue invoice
        for (let inv of overdueInvoices) {
            inv.status = 'overdue';
            await inv.save();
            
            const entity = await Entity.findById(inv.dspEntityId);
            if (entity) {
                entity.strikes += 1;
                if (entity.strikes >= 3) {
                    entity.blacklistStatus = 'blacklisted';
                }
                await entity.save();
            }
        }
        
        res.json({ success: true, processed: overdueInvoices.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// OCR API for scanning
app.post('/api/ocr', async (req, res) => {
    try {
        const { image } = req.body; // Base64 image
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }
        
        // Remove data:image/jpeg;base64, prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        const fetch = (await import('node-fetch')).default || global.fetch;
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.CLOUD_VISION}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [
                    {
                        image: { content: base64Data },
                        features: [{ type: 'TEXT_DETECTION' }]
                    }
                ]
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("Google Cloud Vision Error:", data.error);
            return res.status(500).json({ error: data.error.message || 'Vision API error' });
        }
        
        const annotations = data.responses[0]?.textAnnotations;
        if (annotations && annotations.length > 0) {
            res.json({ text: annotations[0].description });
        } else {
            res.json({ text: '' });
        }
    } catch (err) {
        console.error("OCR Error:", err);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// 10.5. Devices API
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await Device.find({ entityId: req.user?.entityId }).sort('deviceId');
        res.json(devices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/devices', async (req, res) => {
    try {
        const existing = await Device.findOne({ deviceId: req.body.deviceId, entityId: req.user?.entityId });
        if (existing) {
            return res.status(400).json({ error: 'A device with this ID/Serial already exists in your registry.' });
        }
        
        if (req.body.status === 'Assigned' && req.body.assignedVehicle) {
            await Device.updateMany(
                { entityId: req.user?.entityId, type: req.body.type, assignedVehicle: req.body.assignedVehicle },
                { $set: { status: 'Spare', assignedVehicle: '' } }
            );
        }
        
        const device = new Device({ ...req.body, entityId: req.user?.entityId });
        await device.save();
        res.status(201).json(device);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/devices/:id', async (req, res) => {
    try {
        if (req.body.status === 'Assigned' && req.body.assignedVehicle) {
            await Device.updateMany(
                { entityId: req.user?.entityId, type: req.body.type, assignedVehicle: req.body.assignedVehicle, _id: { $ne: req.params.id } },
                { $set: { status: 'Spare', assignedVehicle: '' } }
            );
        }
        const device = await Device.findOneAndUpdate(
            { _id: req.params.id, entityId: req.user?.entityId },
            req.body,
            { new: true }
        );
        res.json(device);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/devices/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
            return res.status(403).json({ error: 'Permission denied: Admins and Managers only' });
        }
        await Device.findOneAndDelete({ _id: req.params.id, entityId: req.user?.entityId });
        res.json({ message: 'Device deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
            return res.status(403).json({ error: 'Permission denied: Admins and Managers only' });
        }
        const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, entityId: req.user?.entityId });
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json({ message: 'Vehicle deleted' });
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
    console.error(`[${new Date().toISOString()}] APP.LISTEN FIRED: Server is successfully running and bound to port ${PORT}!`);
    console.error(`[${new Date().toISOString()}] === STARTUP SEQUENCE COMPLETE ===`);
});
