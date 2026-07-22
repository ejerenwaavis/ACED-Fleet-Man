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
    address: { type: String },
    serviceRadius: { type: Number },
    isVerified: { type: Boolean, default: false },
    autoAcceptRules: { type: Boolean, default: false },
    standardHourlyRate: { type: Number, default: 0 },
    workingHours: { type: String, default: 'Mon-Fri 8am-5pm' },
    
    // Billing & compliance (DSP & MSP)
    strikes: { type: Number, default: 0 },
    blacklistStatus: { type: String, enum: ['active', 'suspended', 'blacklisted'], default: 'active' },
    
    // Directory visibility toggle
    listedInDirectory: { type: Boolean, default: true },
    
    // Public Booking / Landing Page
    publicSlug: { type: String, unique: true, sparse: true },
    publicProfileEnabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Entity', entitySchema);
