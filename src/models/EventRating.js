const mongoose = require('mongoose');

const eventRatingSchema = new mongoose.Schema({
	eventId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Event"
	},
	rating: Number,
	member: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
}, {timestamps: true});

const eventRating = mongoose.model('EventRating', eventRatingSchema);

module.exports = eventRating;
