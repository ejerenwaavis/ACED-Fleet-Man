const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    routeNumber: { type: String, required: true },
    truckNumber: { type: String, required: true },
    status: { type: String, default: 'Active' },
    vin: { type: String },
    licensePlate: { type: String },
    makeModel: { type: String },
    fuelType: { type: String, enum: ['gas', 'diesel', 'electric', 'hybrid'], default: 'gas' },
    lastOilChange: { type: Date },
    lastKnownMileage: { type: Number },
    pendingMaintenance: { type: Boolean, default: false },
    registrationUrl: { type: String },
    dotInspectionUrl: { type: String },
    insuranceUrl: { type: String },
    registrationExpiry: { type: Date },
<<<<<<< HEAD
    lastKnownMileage: { type: Number }
=======
    dotExpiry: { type: Date }
>>>>>>> origin/copilot/check-google-sign-in-issue
}, { timestamps: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
