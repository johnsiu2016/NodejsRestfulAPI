const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: String,
    address_1: String, // Line 1 of venue address
    address_2: String, // Line 2 of venue address
    address_3: String, // Line 3 of venue address
    city: String,
    country: String,
    phone: String,
    lat: Number,
    lon: Number,
});

const Venue = mongoose.model('Event', venueSchema);

module.exports = Venue;