const mongoose = require('mongoose');

<<<<<<< HEAD
const templateItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['boolean', 'text', 'number', 'select'], default: 'boolean' },
    options: [{ type: String }],
    required: { type: Boolean, default: false },
    isMileageField: { type: Boolean, default: false }
}, { _id: false });
=======
const itemSchema = new mongoose.Schema({
    id: { type: String, required: true }, // unique identifier for the field
    label: { type: String, required: true },
    type: { type: String, enum: ['checkbox', 'text', 'number', 'select'], default: 'checkbox' },
    options: [{ type: String }], // For 'select' type
    required: { type: Boolean, default: false },
    isMileageField: { type: Boolean, default: false } // Marks this field's value as the vehicle's odometer reading
});
>>>>>>> origin/copilot/check-google-sign-in-issue

const walkthroughTemplateSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true },
<<<<<<< HEAD
    items: [templateItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughTemplate', walkthroughTemplateSchema);
=======
    frequency: { type: String, enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'], default: 'daily' },
    description: { type: String },
    items: [itemSchema],
    deviceTypes: [{ type: String }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughTemplate', walkthroughTemplateSchema);
>>>>>>> origin/copilot/check-google-sign-in-issue
