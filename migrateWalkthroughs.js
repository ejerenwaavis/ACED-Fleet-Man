const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const EveningWalkthrough = require('./models/EveningWalkthrough');
const WeekendWalkthrough = require('./models/WeekendWalkthrough');
const WalkthroughTemplate = require('./models/WalkthroughTemplate');
const WalkthroughRecord = require('./models/WalkthroughRecord');
const Entity = require('./models/Entity');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const entities = await Entity.find({});
    
    for (const entity of entities) {
      console.log(`Migrating for entity: ${entity.name}`);

      // Create Legacy Evening Template
      const eveningTemplate = await WalkthroughTemplate.findOneAndUpdate(
        { entityId: entity._id, name: 'Legacy Evening Walkthrough' },
        { 
          entityId: entity._id, 
          name: 'Legacy Evening Walkthrough',
          frequency: 'daily',
          isActive: false, // Hide from dashboard since it's legacy
          items: [] // Dynamic mapping of items below
        },
        { upsert: true, new: true }
      );

      // Create Legacy Weekend Template
      const weekendTemplate = await WalkthroughTemplate.findOneAndUpdate(
        { entityId: entity._id, name: 'Legacy Weekend Walkthrough' },
        { 
          entityId: entity._id, 
          name: 'Legacy Weekend Walkthrough',
          frequency: 'weekly',
          isActive: false, 
          items: []
        },
        { upsert: true, new: true }
      );

      // Migrate Evening Records
      const eveningRecords = await EveningWalkthrough.find({ entityId: entity._id });
      console.log(`Found ${eveningRecords.length} evening records.`);
      for (const record of eveningRecords) {
        // Find existing to avoid duplicates if run multiple times
        const existing = await WalkthroughRecord.findOne({ entityId: entity._id, templateId: eveningTemplate._id, date: record.date, vehicleId: record.vehicleId });
        if (!existing) {
          await WalkthroughRecord.create({
            entityId: entity._id,
            templateId: eveningTemplate._id,
            vehicleId: record.vehicleId,
            reporterId: record.reporterId || null,
            date: record.date,
            data: record.checks || {},
            maintenanceNote: record.maintenanceNote || '',
            status: record.status || 'completed'
          });
        }
      }

      // Migrate Weekend Records
      const weekendRecords = await WeekendWalkthrough.find({ entityId: entity._id });
      console.log(`Found ${weekendRecords.length} weekend records.`);
      for (const record of weekendRecords) {
        const existing = await WalkthroughRecord.findOne({ entityId: entity._id, templateId: weekendTemplate._id, date: record.date, vehicleId: record.vehicleId });
        if (!existing) {
          await WalkthroughRecord.create({
            entityId: entity._id,
            templateId: weekendTemplate._id,
            vehicleId: record.vehicleId,
            reporterId: record.reporterId || null,
            date: record.date,
            data: record.checks || {},
            maintenanceNote: record.maintenanceNote || '',
            status: record.status || 'completed'
          });
        }
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
