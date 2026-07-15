const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. Add requires
const requires = `
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const MongoStore = require('connect-mongo');
`;
if (!appCode.includes("require('passport')")) {
    appCode = appCode.replace("const express = require('express');", `const express = require('express');${requires}`);
}

// 2. Add Auth configuration after mongoose connection
const authConfig = `
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
        
        // Option A: Create new Entity and User
        const newEntity = await Entity.create({
            name: profile.displayName + " Fleet",
            contactEmail: profile.emails[0].value
        });

        user = await User.create({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            entityId: newEntity._id,
            role: 'admin'
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
        // Successful authentication, redirect to frontend.
        res.redirect('http://127.0.0.1:3000/roster'); 
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

// --- RBAC Middlewares ---
const isAuthenticated = (req, res, next) => {
    // IF dummy env for testing without auth, bypass
    if (!process.env.GOOGLE_CLIENT_ID) {
        req.user = { entityId: "123456789012345678901234", role: 'admin' };
        return next();
    }
    
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

const isManagerOrAdmin = (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        req.user = { entityId: "123456789012345678901234", role: 'admin' };
        return next();
    }
    if (req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'manager')) return next();
    res.status(403).json({ error: 'Forbidden. Requires manager or admin role.' });
};
`;

if (!appCode.includes('// --- Authentication Setup ---')) {
    appCode = appCode.replace("app.use(express.static('public'));", `app.use(express.static('public'));\n${authConfig}`);
}

fs.writeFileSync(appPath, appCode);
console.log('App configured with Auth.');
