require('dotenv').config();
const mongoose = require('mongoose');
const Entity = require('./models/Entity');
const ChecklistItem = require('./models/ChecklistItem');
const WalkthroughTemplate = require('./models/WalkthroughTemplate');

async function seedWalkthroughs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const entities = await Entity.find();
    console.log(`Found ${entities.length} entities.`);

    for (const entity of entities) {
      // Find evening items
      const eveningItems = await ChecklistItem.find({ entityId: entity._id, eveningWalkthrough: true, isActive: true });
      const weekendItems = await ChecklistItem.find({ entityId: entity._id, weekendWalkthrough: true, isActive: true });

      // Create Evening Walkthrough Template
      const existingEvening = await WalkthroughTemplate.findOne({ entityId: entity._id, name: 'Evening Walkthrough' });
      if (!existingEvening) {
        const eveningTemplateItems = eveningItems.map(item => ({
          id: new mongoose.Types.ObjectId().toString(),
          type: 'checkbox',
          label: item.name,
          required: true
        }));

        await WalkthroughTemplate.create({
          entityId: entity._id,
          name: 'Evening Walkthrough',
          description: 'Daily evening check for vehicle return.',
          frequency: 'daily',
          items: eveningTemplateItems
        });
        console.log(`Created Evening Walkthrough template for entity ${entity.name}`);
      }

      // Create Weekend Walkthrough Template
      const existingWeekend = await WalkthroughTemplate.findOne({ entityId: entity._id, name: 'Weekend Inspection' });
      if (!existingWeekend) {
        const weekendTemplateItems = [
          { id: new mongoose.Types.ObjectId().toString(), type: 'number', label: 'Mileage', required: true },
          ...weekendItems.map(item => ({
            id: new mongoose.Types.ObjectId().toString(),
            type: 'checkbox',
            label: item.name,
            required: true
          })),
          { id: new mongoose.Types.ObjectId().toString(), type: 'text', label: 'Body Damage', required: false }
        ];

        await WalkthroughTemplate.create({
          entityId: entity._id,
          name: 'Weekend Inspection',
          description: 'Comprehensive weekly inspection.',
          frequency: 'weekly',
          items: weekendTemplateItems
        });
        console.log(`Created Weekend Inspection template for entity ${entity.name}`);
      }
    }

    console.log("Seeding complete.");
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    mongoose.disconnect();
  }
}

seedWalkthroughs();
