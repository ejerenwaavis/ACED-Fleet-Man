const mongoose = require('mongoose');

const weekendWalkthroughSchema = new mongoose.Schema({
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    mileage: { type: Number, required: true },
    assetChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    maintenanceNote: { type: String },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WeekendWalkthrough', weekendWalkthroughSchema);
