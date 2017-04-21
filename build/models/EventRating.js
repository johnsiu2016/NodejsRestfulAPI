"use strict";

var mongoose = require('mongoose');

var eventRatingSchema = new mongoose.Schema({
	eventId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Event"
	},
	rating: Number,
	member: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
}, { timestamps: true });

var eventRating = mongoose.model('EventRating', eventRatingSchema);

module.exports = eventRating;