const mongoose = require('mongoose');

const serviceRecordSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    date: { type: Date, required: true },
    maintenanceType: { type: String, required: true },
    details: { type: String, required: true },
    performedBy: { type: String },
    mileageAtService: { type: Number },
    loggedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('ServiceRecord', serviceRecordSchema);
