const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    created: Date, // Creation time of the event, in milliseconds since the epoch
    updated: Date, // Last modified time for the event in milliseconds since the epoch
    name: String, // Name of the event
    description: String,
    time: Date, // UTC start time of the event, in milliseconds since the epoch
    duration: Date, // Scheduled event duration in milliseconds, if an end time is specified by the organizer. When not present, a default of 3 hours may be assumed by applications
    photoAlbum: { // Information about photo uploads for this event, returned when fields request parameter value includes 'photo_album'
        type: [{ // The event venue, present only if selected and not hidden by an organizer
            type: mongoose.Schema.Types.ObjectId,
            ref: "PhotoAlbum"
        }],
        validate: [photosLimit, "{PATH} exceeds the limit of 3"]
    },
    eventHosts: [{ // List of members hosting the event, returned when fields request parameter value includes 'event_hosts'
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    venue: { // The event venue, present only if selected and not hidden by an organizer
        type: mongoose.Schema.Types.ObjectId,
        ref: "Venue"
    },
    fee: String, // Ticketing fee information for events that support payments
    status: String, // "cancelled", "upcoming", "past", "proposed", "suggested", or "draft"
}, {timestamps: true});
const Event = mongoose.model('Event', eventSchema);

function photosLimit(photo) {
    return photo.length <= 3;
}


module.exports = User;
