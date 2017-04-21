const User = require('../models/User');
const Event = require('../models/Event');
const Photo = require('../models/Photo');

exports.getAdmin = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return res.send('No permission');

	User.find({}, (err, allUsers) => {
		if (err) console.log(err);

		Event.find({}, (err, allEvents) => {
			if (err) console.log(err);

			Photo.find({}, (err, allPhotos) => {
				if (err) console.log(err);

				res.render('admin', {
					title: 'Admin Control Panel',
					allUsers,
					allEvents,
					allPhotos
				});
			});
		});
	});
};

exports.postDeleteAccount = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return;

	User.remove({_id: req.body.id}, (err) => {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};


exports.postDeleteEvent = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return;

	Event.remove({_id: req.body.id}, (err) => {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};

exports.postDeletePhoto = (req, res) => {
	if (String(req.user._id) !== process.env.ADMIN)
		return;

	Photo.remove({_id: req.body.id}, (err) => {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};


