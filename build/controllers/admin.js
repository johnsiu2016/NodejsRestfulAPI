'use strict';

var User = require('../models/User');
var Event = require('../models/Event');
var Photo = require('../models/Photo');

exports.getAdmin = function (req, res) {
	if (String(req.user._id) !== process.env.ADMIN) return res.send('No permission');

	User.find({}, function (err, allUsers) {
		if (err) console.log(err);

		Event.find({}, function (err, allEvents) {
			if (err) console.log(err);

			Photo.find({}, function (err, allPhotos) {
				if (err) console.log(err);

				res.render('admin', {
					title: 'Admin Control Panel',
					allUsers: allUsers,
					allEvents: allEvents,
					allPhotos: allPhotos
				});
			});
		});
	});
};

exports.postDeleteAccount = function (req, res) {
	if (String(req.user._id) !== process.env.ADMIN) return;

	User.remove({ _id: req.body.id }, function (err) {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};

exports.postDeleteEvent = function (req, res) {
	if (String(req.user._id) !== process.env.ADMIN) return;

	Event.remove({ _id: req.body.id }, function (err) {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};

exports.postDeletePhoto = function (req, res) {
	if (String(req.user._id) !== process.env.ADMIN) return;

	Photo.remove({ _id: req.body.id }, function (err) {
		if (err) console.log(err);

		res.redirect('/admin');
	});
};