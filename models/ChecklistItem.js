const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true, unique: true },
    eveningWalkthrough: { type: Boolean, default: false },
    weekendWalkthrough: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ChecklistItem', checklistItemSchema);
