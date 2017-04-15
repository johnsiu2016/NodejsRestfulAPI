const mongoose = require('mongoose');

const eventCommentSchema = new mongoose.Schema({
	title: String,
	comment: String,
	member: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
}, {timestamps: true});

const eventComment = mongoose.model('eventComment', eventCommentSchema);

module.exports = eventComment;
