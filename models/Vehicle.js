const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    routeNumber: { type: String, required: true },
    truckNumber: { type: String, required: true },
    status: { type: String, default: 'Active' },
    vin: { type: String },
    licensePlate: { type: String },
    makeModel: { type: String },
    fuelType: { type: String, enum: ['gas', 'diesel', 'electric', 'hybrid'], default: 'gas' },
    lastOilChange: { type: Date },
    pendingMaintenance: { type: Boolean, default: false },
    registrationUrl: { type: String },
    dotInspectionUrl: { type: String },
    insuranceUrl: { type: String },
    registrationExpiry: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
