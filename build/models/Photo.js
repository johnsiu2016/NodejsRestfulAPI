'use strict';

var mongoose = require('mongoose');

var photoSchema = new mongoose.Schema({
    photoURL: String,
    highresURL: String,
    type: String, // user or event; for indexing?
    baseUrl: String // indexing?
}, { timestamps: true });

var Photo = mongoose.model('Photo', photoSchema);

module.exports = Photo;