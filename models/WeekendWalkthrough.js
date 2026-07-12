const mongoose = require('mongoose');

const weekendWalkthroughSchema = new mongoose.Schema({
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    mileage: { type: Number, required: true },
    checks: {
        sideMirrors: { type: Boolean, default: true },
        bodyDamage: { type: String, default: 'None' },
    },
    maintenanceNote: { type: String },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WeekendWalkthrough', weekendWalkthroughSchema);
