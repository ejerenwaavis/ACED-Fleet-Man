const mongoose = require('mongoose');

const walkthroughRecordSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalkthroughTemplate', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    mileage: { type: Number },
<<<<<<< HEAD
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    maintenanceNote: { type: String },
    status: { type: String, enum: ['draft', 'completed'], default: 'draft' }
=======
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // Stores key-value mapping of template fields
    maintenanceNote: { type: String },
    status: { type: String, enum: ['draft', 'completed'], default: 'completed' }
>>>>>>> origin/copilot/check-google-sign-in-issue
}, { timestamps: true });

module.exports = mongoose.model('WalkthroughRecord', walkthroughRecordSchema);
