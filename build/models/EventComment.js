'use strict';

var mongoose = require('mongoose');

var eventCommentSchema = new mongoose.Schema({
	title: String,
	comment: String,
	member: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
}, { timestamps: true });

var eventComment = mongoose.model('EventComment', eventCommentSchema);

module.exports = eventComment;