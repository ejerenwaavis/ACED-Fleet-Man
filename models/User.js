const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' }, // Optional for new users
    googleId: { type: String, unique: true, sparse: true },
    displayName: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional if using Google Auth
    role: { type: String, enum: ['admin', 'manager', 'driver', 'unassigned'], default: 'unassigned' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
