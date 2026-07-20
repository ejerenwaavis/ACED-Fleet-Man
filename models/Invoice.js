const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    dspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    mspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    maintenanceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest', required: true },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'paid', 'overdue'],
        default: 'pending'
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
