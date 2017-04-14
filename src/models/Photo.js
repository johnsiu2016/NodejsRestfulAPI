const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    photoURL: String,
    highresURL: String,
    type: String, // user or event; for indexing?
    baseUrl: String // indexing?
}, {timestamps: true});

const Photo = mongoose.model('Photo', photoSchema);

module.exports = Photo;
