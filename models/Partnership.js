const mongoose = require('mongoose');

const partnershipSchema = new mongoose.Schema({
    dspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    mspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    status: {
        type: String,
        enum: ['requested', 'active', 'suspended', 'terminated'],
        default: 'requested'
    },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date },
    terms: { type: String },
    defaultAutoAssign: { type: Boolean, default: true }
}, { timestamps: true });

partnershipSchema.index({ dspEntityId: 1, mspEntityId: 1 }, { unique: true });

module.exports = mongoose.model('Partnership', partnershipSchema);
