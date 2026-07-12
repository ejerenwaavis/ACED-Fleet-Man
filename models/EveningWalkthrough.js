const mongoose = require('mongoose');

const eveningWalkthroughSchema = new mongoose.Schema({
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    checks: {
        scanner: { type: Boolean, default: true },
        gasCard: { type: Boolean, default: true },
        batteries: { type: Boolean, default: true },
    },
    maintenanceNote: { type: String },
    routing: { type: String, enum: ['none', 'internal', 'mechanic'], default: 'none' },
    status: { type: String, enum: ['draft', 'completed'], default: 'draft' }
}, { timestamps: true });

module.exports = mongoose.model('EveningWalkthrough', eveningWalkthroughSchema);
