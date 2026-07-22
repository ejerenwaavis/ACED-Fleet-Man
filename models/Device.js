const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    type: { type: String, enum: ['scanner', 'ipad', 'radar', 'camera', 'other'], required: true },
    deviceId: { type: String, required: true },
    model: { type: String },
    status: { type: String, enum: ['Assigned', 'Faulty', 'In Repair', 'Retired', 'Spare'], default: 'Spare' },
    assignedVehicle: { type: String }, // Truck number
    notes: { type: String },
    lastMaintenanceDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
