const mongoose = require('mongoose');

const walkthroughRecordSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalkthroughTemplate', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    mileage: { type: Number },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    maintenanceNote: { type: String },
    status: { type: String, enum: ['draft', 'completed'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughRecord', walkthroughRecordSchema);
