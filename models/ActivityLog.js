const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    action: { type: String, required: true }, // 'status_change', 'part_added', 'note_added', 'invoice_generated', etc.
    fromValue: { type: String },
    toValue: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
