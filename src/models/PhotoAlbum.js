const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    create: Date,
    title: String,
    photos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Photo"
    }],
    validate: [photosLimit, "{PATH} exceeds the limit of 8"]
});

function photosLimit(photos) {
    return photos.length <= 8;
}

const Venue = mongoose.model('Event', venueSchema);

module.exports = Venue;