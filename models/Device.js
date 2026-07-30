const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    type: { type: String, required: true },
    deviceId: { type: String, required: true },
    model: { type: String },
    imei: { type: String },
    ownership: { type: String },
    provider: { type: String },
    status: { type: String, enum: ['Assigned', 'Faulty', 'In Repair', 'Retired', 'Spare'], default: 'Spare' },
    assignedVehicle: { type: String }, // Truck number
    notes: { type: String },
    lastMaintenanceDate: { type: Date },
    // Discovered after finding that printed serial/IMEI stickers (e.g. battery compartment)
    // don't always match what the device's own OS/software reports. This is intentionally
    // separate from `deviceId`/`imei` above rather than replacing them, so the original
    // as-printed values are never lost even after a corrected value is recorded.
    verifiedSerialNumber: { type: String },
    verifiedBy: { type: String } // Name of the engineer/tech who confirmed the corrected serial
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
