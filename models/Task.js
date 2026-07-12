const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String, enum: ['general', 'maintenance', 'walkthrough-issue'], default: 'general' },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
    dueDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
