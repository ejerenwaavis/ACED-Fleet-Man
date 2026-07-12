const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    vehicleId: { type: String, required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'cancelled'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    photoUrl: { type: String }, // Cloudinary URL will go here
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
