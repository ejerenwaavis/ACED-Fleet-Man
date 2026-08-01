const mongoose = require('mongoose');

const templateItemSchema = new mongoose.Schema({
    id: { type: String, required: true }, // unique identifier for the field
    label: { type: String, required: true },
    type: { type: String, enum: ['boolean', 'text', 'number', 'select'], default: 'boolean' },
    options: [{ type: String }], // For 'select' type
    required: { type: Boolean, default: false },
    isMileageField: { type: Boolean, default: false } // Marks this field's value as the vehicle's odometer reading
}, { _id: false });

const walkthroughTemplateSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'], default: 'daily' },
    description: { type: String },
    items: [templateItemSchema],
    deviceTypes: [{ type: String }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughTemplate', walkthroughTemplateSchema);
