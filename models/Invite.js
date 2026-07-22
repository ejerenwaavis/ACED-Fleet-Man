const mongoose = require('mongoose');
const crypto = require('crypto');

const inviteSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomBytes(20).toString('hex')
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entity',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'driver', 'mechanic'],
        required: true,
        default: 'driver'
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired', 'revoked'],
        default: 'pending'
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    },
    claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Auto-expire
inviteSchema.methods.isExpired = function() {
    return this.expiresAt < new Date() || this.status === 'expired';
};

module.exports = mongoose.model('Invite', inviteSchema);
