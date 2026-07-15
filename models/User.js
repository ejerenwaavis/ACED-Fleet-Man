const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
