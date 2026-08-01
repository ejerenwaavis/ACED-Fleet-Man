require('dotenv').config();
const mongoose = require('mongoose');
const Entity = require('../models/Entity');

async function migrateEntities() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Entity.updateMany(
            { entityType: { $exists: false } },
            { $set: { entityType: 'dsp', listedInDirectory: true, isVerified: false } }
        );

        console.log(`Migration completed. Modified ${result.modifiedCount} entities.`);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrateEntities();
