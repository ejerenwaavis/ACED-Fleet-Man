const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    id: { type: String, required: true }, // unique identifier for the field
    label: { type: String, required: true },
    type: { type: String, enum: ['checkbox', 'text', 'number', 'select'], default: 'checkbox' },
    options: [{ type: String }], // For 'select' type
    required: { type: Boolean, default: false }
});

const walkthroughTemplateSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'], default: 'daily' },
    description: { type: String },
    items: [itemSchema],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughTemplate', walkthroughTemplateSchema);
