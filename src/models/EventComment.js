const mongoose = require('mongoose');

const eventCommentSchema = new mongoose.Schema({
	title: String,
	comment: String,
}, {timestamps: true});

const eventComment = mongoose.model('eventComment', eventCommentSchema);

module.exports = eventComment;
