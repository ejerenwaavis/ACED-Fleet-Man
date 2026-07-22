const mongoose = require('mongoose');

const templateItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['boolean', 'text', 'number', 'select'], default: 'boolean' },
    options: [{ type: String }],
    required: { type: Boolean, default: false },
    isMileageField: { type: Boolean, default: false }
}, { _id: false });

const walkthroughTemplateSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true },
    items: [templateItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughTemplate', walkthroughTemplateSchema);
