const mongoose = require('mongoose');

const eventRatingSchema = new mongoose.Schema({
	eventID: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Event"
	},
	rating: Number,
	member: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
}, {timestamps: true});

const eventRating = mongoose.model('eventRating', eventRatingSchema);

module.exports = eventRating;
