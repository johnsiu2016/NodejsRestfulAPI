const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    create: Date,
    type: String, // user or event
    highresLink: String,
    thumbLink: String
});

const Venue = mongoose.model('Event', venueSchema);

module.exports = Venue;