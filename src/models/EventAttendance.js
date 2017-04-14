const mongoose = require('mongoose');

const eventAttendanceSchema = new mongoose.Schema({
	members: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}]
}, {timestamps: true});

const eventAttendance = mongoose.model('eventAttendance', eventAttendanceSchema);

module.exports = eventAttendance;