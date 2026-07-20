const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requestType: { type: String, enum: ['Vehicle Issue', 'Property / Facility Issue'], default: 'Vehicle Issue' },
    vehicleId: { type: String }, // Optional for Property issues
    location: { type: String }, // For property issues or vehicle locations
    attachments: [{ type: String }], // Array of Cloudinary URLs (from DSP)
    mechanicAttachments: [{ type: String }], // Array of Cloudinary URLs (from Mechanic)
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: [
            'pending',
            'assigned',
            'accepted',
            'in-progress',
            'awaiting-parts',
            'completed',
            'invoiced',
            'closed',
            'cancelled'
        ],
        default: 'pending'
    },
    priority: { type: String, default: 'medium' },
    photoUrl: { type: String }, // Cloudinary URL will go here
    
    // MSP / Job fields
    assignedMspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
    assignedMechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    laborHours: { type: Number },
    laborRate: { type: Number },
    mechanicNotes: { type: String },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
