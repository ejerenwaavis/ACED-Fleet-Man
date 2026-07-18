const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    entityType: {
        type: String,
        enum: ['dsp', 'msp'],
        required: true,
        default: 'dsp'
    },
    contactEmail: { type: String },
    contactPhone: { type: String },
    
    // MSP-only fields
    specialties: [{ type: String }],
    serviceRadius: { type: Number },
    isVerified: { type: Boolean, default: false },
    
    // Directory visibility toggle
    listedInDirectory: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);
