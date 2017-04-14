const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: String,
    address1: String, // Line 1 of venue address
    address2: String, // Line 2 of venue address
    address3: String, // Line 3 of venue address
    city: String,
    country: String,
    phone: String,
    lat: Number,
    lon: Number,
    events: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event"
    }],
});

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue;
