const mongoose = require('mongoose');

const weekendWalkthroughSchema = new mongoose.Schema({
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    mileage: { type: Number, required: true },
    assetChecks: {
        windscreen: { status: { type: String, enum: ['pass', 'fail'], default: 'pass' }, notes: { type: String, default: '' } },
        wipers: { status: { type: String, enum: ['pass', 'fail'], default: 'pass' }, notes: { type: String, default: '' } },
        mirrors: { status: { type: String, enum: ['pass', 'fail'], default: 'pass' }, notes: { type: String, default: '' } },
        tires: { status: { type: String, enum: ['pass', 'fail'], default: 'pass' }, notes: { type: String, default: '' } }
    },
    maintenanceNote: { type: String },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WeekendWalkthrough', weekendWalkthroughSchema);
