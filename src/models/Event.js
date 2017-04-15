const mongoose = require('mongoose');
const mongoFieldUpperLimitValidation = require("../myUtil").mongoFieldUpperLimitValidation;

const eventSchema = new mongoose.Schema({
    name: String, // Name of the event
    description: String,
    time: String, // UTC start time of the event, in milliseconds since the epoch
    duration: String, // Scheduled event duration in milliseconds, if an end time is specified by the organizer. When not present, a default of 3 hours may be assumed by applications
    photos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Photo"
    }],
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

    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventComment"
    }],
    attendance: [{
	    member: {
		    type: mongoose.Schema.Types.ObjectId,
		    ref: "User"
	    },
	    joinedDate: {
	    	type: Date,
		    default: Date.now
	    },
	    _id: false
    }],
    rating: {
        overall: Number,
        count: Number
    }

}, {timestamps: true});

eventSchema.path('photos').validate(mongoFieldUpperLimitValidation(8), "{PATH} exceeds the limit of 8");

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
