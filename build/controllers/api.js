'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var User = require('../models/User');
var Photo = require('../models/Photo');
var Event = require('../models/Event');
var Venue = require('../models/Venue');
var EventComment = require('../models/EventComment');
var EventRating = require('../models/EventRating');

var passport = require('passport');
var jwt = require('jsonwebtoken');
var sharp = require('sharp');
var myUtil = require('../myUtil');
var apiOutputTemplate = myUtil.apiOutputTemplate;
var moment = require('moment');

var async = require('async');
var graph = require('fbgraph');
var foursquare = require('node-foursquare')({
	secrets: {
		clientId: process.env.FOURSQUARE_ID,
		clientSecret: process.env.FOURSQUARE_SECRET,
		redirectUrl: process.env.FOURSQUARE_REDIRECT_URL
	}
});

// Sign Up
exports.postSignup = function (req, res) {
	var validationSchema = {
		"email": {
			notEmpty: {
				errorMessage: "Email cannot be blank."
			},
			isEmail: {
				errorMessage: "Please enter a valid email address."
			}
		},
		"password": {
			notEmpty: {
				errorMessage: "Password cannot be blank."
			},
			isLength: {
				options: [{ min: 6, max: 100 }],
				errorMessage: "Password must be at least 6 characters long"
			}
		},
		"confirmPassword": {
			notEmpty: {
				errorMessage: "Password cannot be blank."
			},
			equals: {
				options: [req.body.password],
				errorMessage: "confirmPassword does not match"
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		var user = new User({
			email: req.body.email,
			password: req.body.password
		});

		User.findOne({ email: req.body.email }, function (err, existingUser) {
			if (err) console.log(err);

			if (existingUser) {
				return res.json(apiOutputTemplate("error", 'Account with that email address already exists.'));
			}

			user.save(function (err) {
				if (err) {
					console.log(err);
				}

				var jwtToken = jwt.sign({
					id: user.id
				}, process.env.JWTSECRET);

				return res.json(apiOutputTemplate("success", 'Successfully signed up', {
					token: 'JWT ' + jwtToken,
					id: user.id
				}));
			});
		});
	});
};

// Log in
exports.postLogin = function (req, res) {
	var validationSchema = {
		"email": {
			notEmpty: {
				errorMessage: "Email cannot be blank."
			},
			isEmail: {
				errorMessage: "Please enter a valid email address."
			}
		},
		"password": {
			notEmpty: {
				errorMessage: "Password cannot be blank."
			},
			isLength: {
				options: [{ min: 6, max: 100 }],
				errorMessage: "Password must be at least 6 characters long"
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		passport.authenticate('local', function (err, user, info) {
			if (err) console.log(err);

			if (!user) {
				return res.json(apiOutputTemplate("error", info.msg));
			}

			var jwtToken = jwt.sign({
				id: user.id
			}, process.env.JWTSECRET);

			return res.json(apiOutputTemplate("success", "Successfully logged in.", {
				token: 'JWT ' + jwtToken,
				id: user.id
			}));
		})(req, res);
	});
};

// Get Account Profile
exports.getMemberProfile = function (req, res) {
	Photo.populate(req.user, [{
		path: "profile.photos profile.avatar",
		select: "photoURL highresURL"
	}, {
		path: "events",
		model: "Event",
		select: "name description time duration fee status"
	}, {
		path: "joinedEvents",
		model: "Event",
		select: "name description time duration fee status"
	}], function (err, populatedUser) {
		if (err) return res.json(apiOutputTemplate("error", err.errors));

		return res.json(apiOutputTemplate("success", 'success', {
			email: req.user.email,
			profile: populatedUser.profile,
			events: populatedUser.events,
			joinedEvents: populatedUser.joinedEvents
		}));
	});
};

// Update Account Profile
exports.patchMemberProfile = function (req, res) {

	req.sanitize('name').escape();
	req.sanitize('name').trim();
	req.sanitize('location').escape();
	req.sanitize('location').trim();

	// mongoose array no indexof method.
	var tmpPhotos = [];
	req.user.profile.photos.forEach(function (photo) {
		tmpPhotos.push(photo);
	});

	var validationSchema = {
		"email": {
			optional: true,
			isEmail: {
				errorMessage: "Please enter a valid email address."
			}
		},
		"name": {
			optional: true,
			isLength: {
				options: [{ max: 15 }],
				errorMessage: "The length of name should not exceed 15 characters"
			}
		},
		"gender": {
			optional: true,
			isIn: {
				options: [['male', 'female', 'other']],
				errorMessage: 'Gender should only be one of the [' + ['male', 'female', 'other'].toString() + ']'
			}
		},
		"location": {
			optional: true,
			isLength: {
				options: [{ max: 150 }],
				errorMessage: "The length of location should not exceed 150 characters"
			}
		},
		"phone": {
			optional: true,
			isNumeric: {
				errorMessage: "Phone should only contains number"
			},
			isLength: {
				options: [{ max: 11, min: 8 }],
				errorMessage: "The length of phone should not exceed 11 characters"
			}
		},
		"website": {
			optional: true,
			isURL: {
				errorMessage: "Please enter a URL."
			},
			isLength: {
				options: [{ max: 200 }],
				errorMessage: "The length of website should not exceed 200 characters"
			}
		},
		"avatar": {
			optional: true,
			isIn: {
				options: [tmpPhotos],
				errorMessage: 'Avatar should only be one of the [' + tmpPhotos.toString() + ']'
			},
			isLength: {
				options: [{ max: 200 }],
				errorMessage: "The length of website should not exceed 200 characters"
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		var user = req.user;
		var profile = req.user.profile;
		var body = req.body;

		user.email = body.email || user.email;
		profile.name = body.name || profile.name;
		profile.gender = body.gender || profile.gender;
		profile.location = body.location || profile.location;
		profile.phone = body.phone || profile.phone;
		profile.website = body.website || profile.website;
		profile.avatar = body.avatar || profile.avatar;

		user.save(function (err, savedUser) {
			if (err) {
				if (err.code === 11000) {
					return res.json(apiOutputTemplate("error", 'The email address you have entered is already associated with an account.'));
				}
				console.log(err);
			}

			Photo.populate(savedUser, {
				path: "profile.photos profile.avatar",
				select: "photoURL highresURL"
			}, function (err, populatedSavedUser) {
				if (err) return res.json(apiOutputTemplate("error", err.errors));

				return res.json(apiOutputTemplate("success", 'success', { profile: populatedSavedUser.profile }));
			});
		});
	});
};

exports.postMemberPhoto = function (req, res) {
	if (req.user.profile.photos.length >= 8) {
		return res.json(apiOutputTemplate("error", "profile.photos exceeds the limit of 8"));
	}

	myUtil.photoUpload(req, res, function (savedPhoto) {
		if (!savedPhoto) return res.json(apiOutputTemplate("error", 'savedPhoto is undefined'));

		var user = req.user;
		var profile = req.user.profile;

		if (!profile.avatar) {
			profile.avatar = savedPhoto._id;
		}
		user.profile.photos.push(savedPhoto._id);
		user.save(function (err, savedUser) {
			if (err) console.log(err);
			if (!savedUser) return res.json(apiOutputTemplate("error", 'savedUser is undefined'));

			Photo.populate(savedUser, {
				path: "profile.photos profile.avatar",
				select: "photoURL highresURL"
			}, function (err, populatedSavedUser) {
				if (err) return res.json(apiOutputTemplate("error", err.errors));

				return res.json(apiOutputTemplate("success", 'success', { profile: populatedSavedUser.profile }));
			});
		});
	});
};

// delete method do not have user found in passport now
exports.deleteMemberPhoto = function (req, res) {
	// one to one ref delete
	// delete photo doc and delete actual photo
	myUtil.photoDelete(req, res, function () {
		// delete user doc
		// use findById, because I need to update avatar using current value but single update operation does not provide current field value
		User.findById(req.params.member_id, function (err, foundUser) {
			if (err) console.log(err);
			if (!foundUser) return res.json(apiOutputTemplate("error", req.params.member_id + ' is not found'));

			var profile = foundUser.profile;
			profile.photos = profile.photos.filter(function (photo) {
				return photo != req.params.photo_id;
			});
			// use double equal, because javascript string type != mongoose string type
			if (req.params.photo_id == profile.avatar) {
				profile.avatar = profile.photos[0];
			}
			foundUser.save(function (err, savedUser) {
				if (err) console.log(err);
				if (!savedUser) return res.json(apiOutputTemplate("error", 'savedUser is undefined'));

				Photo.populate(savedUser, {
					path: "profile.photos profile.avatar",
					select: "photoURL highresURL"
				}, function (err, populatedSavedUser) {
					if (err) return res.json(apiOutputTemplate("error", err.errors));

					return res.json(apiOutputTemplate("success", 'success', { profile: populatedSavedUser.profile }));
				});
			});
		});

		// User.update({_id: req.user.id}, {$pull: {"profile.photos": req.params.photo_id}}, (err, numberAffected) => {
		//     if (err) console.log(err);
		//
		//     return res.json(apiOutputTemplate("success", "Photos has been deleted from user.", {numberAffected: numberAffected}));
		// });
	});
};

exports.postEventPhoto = function (req, res) {
	Event.findById(req.params.event_id, function (err, foundEvent) {
		if (err) console.log(err);
		if (!foundEvent) return res.json(apiOutputTemplate("error", req.params.event_id + ' is not found'));

		for (var i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
			if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", '403 Forbidden: No permission'));
		}

		if (foundEvent.photos.length >= 8) {
			return res.json(apiOutputTemplate("error", "Photos exceeds the limit of 8"));
		}

		myUtil.photoUpload(req, res, function (savedPhoto) {
			foundEvent.photos.push(savedPhoto._id);
			foundEvent.save(function (err, savedEvent) {
				if (err) console.log(err);
				if (!savedEvent) return res.json(apiOutputTemplate("error", 'savedEvent is undefined'));

				Event.populate(savedEvent, [{
					path: "eventHosts",
					model: "User",
					select: "profile.name profile.gender profile.location profile.avatar",
					populate: {
						path: "profile.avatar",
						model: "Photo",
						select: "photoURL highresURL"
					}
				}, {
					path: "photos",
					model: "Photo",
					select: "photoURL highresURL"
				}, {
					path: "venue",
					model: "Venue",
					select: "name address1 address2 address3 city country phone"
				}], function (err, populatedSavedEvent) {
					if (err) console.log(err);
					if (!populatedSavedEvent) return res.json(apiOutputTemplate("error", 'populatedSavedEvent is undefined'));

					return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedEvent }));
				});
			});
		});
	});
};

// delete method do not have user found in passport now
exports.deleteEventPhoto = function (req, res) {
	// delete user doc
	// use findById, because I need to update avatar using current value but single update operation does not provide current field value
	Event.findById(req.params.event_id, function (err, foundEvent) {
		if (err) console.log(err);
		if (!foundEvent) return res.json(apiOutputTemplate("error", req.params.event_id + ' is not found'));

		for (var i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
			if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", '403 Forbidden: No permission'));
		}

		myUtil.photoDelete(req, res, function () {
			foundEvent.photos = foundEvent.photos.filter(function (photo) {
				return photo != req.params.photo_id;
			});
			foundEvent.save(function (err, savedEvent) {
				if (err) console.log(err);

				Event.populate(savedEvent, [{
					path: "eventHosts",
					model: "User",
					select: "profile.name profile.gender profile.location profile.avatar",
					populate: {
						path: "profile.avatar",
						model: "Photo",
						select: "photoURL highresURL"
					}
				}, {
					path: "photos",
					model: "Photo",
					select: "photoURL highresURL"
				}, {
					path: "venue",
					model: "Venue",
					select: "name address1 address2 address3 city country phone"
				}], function (err, populatedSavedEvent) {
					if (err) console.log(err);
					if (!populatedSavedEvent) return res.json(apiOutputTemplate("error", 'populatedSavedEvent is undefined'));

					return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedEvent }));
				});
			});
		});
	});
};

exports.getMemberEventsList = function (req, res) {
	Event.populate(req.user, {
		path: "events",
		populate: [{
			path: "eventHosts",
			model: "User",
			select: "profile.name profile.gender profile.location profile.avatar",
			populate: {
				path: "profile.avatar",
				model: "Photo",
				select: "photoURL highresURL"
			}
		}, {
			path: "photos",
			model: "Photo",
			select: "photoURL highresURL"
		}, {
			path: "venue",
			model: "Venue",
			select: "name address1 address2 address3 city country phone"
		}, {
			path: 'attendance.member',
			model: 'User',
			select: 'profile.name profile.gender profile.avatar',
			populate: {
				path: "profile.avatar",
				model: "Photo",
				select: "photoURL highresURL"
			}
		}, {
			path: 'comments',
			model: 'EventComment',
			select: 'title comment member createdAt',
			populate: {
				path: "member",
				model: "User",
				select: "profile.name profile.gender profile.avatar",
				populate: {
					path: "profile.avatar",
					model: "Photo",
					select: "photoURL highresURL"
				}
			}
		}]
	}, function (err, populatedUser) {
		if (err) console.log(err);
		if (!populatedUser) return res.json(apiOutputTemplate("error", 'populatedUser is undefined'));

		return res.json(apiOutputTemplate("success", 'success', { events: populatedUser.events }));
	});
};

exports.getMemberEvent = function (req, res) {
	Event.findById(req.params.event_id, function (err, foundEvent) {
		if (err) console.log(err);
		if (!foundEvent) return res.json(apiOutputTemplate("error", req.params.event_id + ' is not found'));

		Event.populate(foundEvent, [{
			path: "eventHosts",
			model: "User",
			select: "profile.name profile.gender profile.location profile.avatar",
			populate: {
				path: "profile.avatar",
				model: "Photo",
				select: "photoURL highresURL"
			}
		}, {
			path: "photos",
			model: "Photo",
			select: "photoURL highresURL"
		}, {
			path: "venue",
			model: "Venue",
			select: "name address1 address2 address3 city country phone"
		}, {
			path: 'attendance.member',
			model: 'User',
			select: 'profile.name profile.gender profile.avatar',
			populate: {
				path: "profile.avatar",
				model: "Photo",
				select: "photoURL highresURL"
			}
		}, {
			path: 'comments',
			model: 'EventComment',
			select: 'title comment member createdAt',
			populate: {
				path: "member",
				model: "User",
				select: "profile.name profile.gender profile.avatar",
				populate: {
					path: "profile.avatar",
					model: "Photo",
					select: "photoURL highresURL"
				}
			}
		}], function (err, populatedFoundEvent) {
			if (err) console.log(err);
			if (!populatedFoundEvent) return res.json(apiOutputTemplate("error", 'populatedFoundEvent is undefined'));

			return res.json(apiOutputTemplate("success", 'success', { events: populatedFoundEvent }));
		});
	});
};

myUtil.configNumeral();
var numeral = require('numeral');

exports.postMemberEvent = function (req, res) {
	var validationSchema = {
		"name": {
			notEmpty: true,
			isLength: {
				options: [{ max: 25 }],
				errorMessage: "The length of name should not exceed 25 characters."
			},
			errorMessage: "Name is required."
		},
		"description": {
			notEmpty: true,
			isLength: {
				options: [{ max: 200 }],
				errorMessage: "The length of name should not exceed 200 characters."
			},
			errorMessage: "Description is required."
		},
		"time": {
			isDate: {
				errorMessage: "Date is not valid. Example of valid date: 2017-01-18 15:00:00"
			}
		},
		"duration": {
			isNumeric: {
				errorMessage: "Duration is not valid."
			}
		},
		"fee": {
			isNumeric: {
				errorMessage: "Fee is not valid."
			}
		},
		"status": {
			isIn: {
				options: [["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]],
				errorMessage: 'status should be one of the value of the list ' + ["cancelled", "upcoming", "past", "proposed", "suggested", "draft"] + '.'
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		req.sanitize('name').escape();
		req.sanitize('name').trim();
		req.sanitize('description').escape();
		req.sanitize('description').trim();

		var user = req.user;
		var body = req.body;

		var event = new Event({
			name: body.name,
			description: body.description,
			time: moment(req.body.time).unix(),
			duration: moment.duration(Number(body.duration), 'hours').asSeconds(),
			eventHosts: [user._id],
			fee: numeral(body.fee).format('$0,0'),
			status: body.status
		});

		event.save(function (err, savedEvent) {
			if (err) console.log(err);
			if (!savedEvent) return res.json(apiOutputTemplate("error", 'savedEvent is undefined'));

			user.events.push(savedEvent._id);
			user.save(function (err, savedUser) {
				if (err) console.log(err);
				if (!savedUser) return res.json(apiOutputTemplate("error", 'savedUser is undefined'));

				Event.populate(savedUser, {
					path: "events",
					populate: [{
						path: "eventHosts",
						model: "User",
						select: "profile.name profile.gender profile.location profile.avatar",
						populate: {
							path: "profile.avatar",
							model: "Photo",
							select: "photoURL highresURL"
						}
					}, {
						path: "photos",
						model: "Photo",
						select: "photoURL highresURL"
					}, {
						path: "venue",
						model: "Venue",
						select: "name address1 address2 address3 city country phone"
					}]
				}, function (err, populatedSavedUser) {
					if (err) console.log(err);
					if (!populatedSavedUser) return res.json(apiOutputTemplate("error", 'populatedSavedUser is undefined'));

					return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedUser.events }));
				});
			});
		});
	});
};

exports.patchMemberEvent = function (req, res) {
	var validationSchema = {
		"name": {
			notEmpty: true,
			isLength: {
				options: [{ max: 25 }],
				errorMessage: "The length of name should not exceed 25 characters."
			},
			errorMessage: "Name is required."
		},
		"description": {
			notEmpty: true,
			isLength: {
				options: [{ max: 200 }],
				errorMessage: "The length of name should not exceed 200 characters."
			},
			errorMessage: "Description is required."
		},
		"time": {
			isDate: {
				errorMessage: "Date is not valid. Example of valid date: 2017-01-18 15:00:00"
			}
		},
		"duration": {
			isNumeric: {
				errorMessage: "Duration is not valid."
			}
		},
		"fee": {
			isNumeric: {
				errorMessage: "Fee is not valid."
			}
		},
		"status": {
			isIn: {
				options: [["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]],
				errorMessage: 'status should be one of the value of the list ' + ["cancelled", "upcoming", "past", "proposed", "suggested", "draft"] + '.'
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		req.sanitize('name').escape();
		req.sanitize('name').trim();
		req.sanitize('description').escape();
		req.sanitize('description').trim();

		Event.findById(req.params.event_id, function (err, foundEvent) {
			if (err) console.log(err);
			if (!foundEvent) return res.json(apiOutputTemplate("error", req.params.event_id + ' is not found'));

			var body = req.body;
			foundEvent.name = body.name;
			foundEvent.description = body.description;
			foundEvent.time = moment(req.body.time).unix();
			foundEvent.duration = moment.duration(Number(body.duration), 'hours').asSeconds();
			foundEvent.fee = numeral(body.fee).format('$0,0');
			foundEvent.status = body.status;
			foundEvent.save(function (err, savedEvent) {
				if (err) console.log(err);
				if (!savedEvent) return res.json(apiOutputTemplate("error", 'savedEvent is undefined'));

				Event.populate(savedEvent, [{
					path: "eventHosts",
					model: "User",
					select: "profile.name profile.gender profile.location profile.avatar",
					populate: {
						path: "profile.avatar",
						model: "Photo",
						select: "photoURL highresURL"
					}
				}, {
					path: "photos",
					model: "Photo",
					select: "photoURL highresURL"
				}, {
					path: "venue",
					model: "Venue",
					select: "name address1 address2 address3 city country phone"
				}], function (err, populatedSavedEvent) {
					if (err) console.log(err);
					if (!populatedSavedEvent) return res.json(apiOutputTemplate("error", 'populatedSavedEvent is undefined'));

					return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedEvent }));
				});
			});
		});
	});
};

exports.deleteMemberEvent = function (req, res) {
	User.findById(req.user.id, function (err, foundUser) {
		if (err) console.log(err);
		if (!foundUser) return res.json(apiOutputTemplate("error", req.user.id + ' is not found'));

		Event.findById(req.params.event_id, function (err, foundEvent) {
			if (err) console.log(err);
			if (!foundEvent) return res.json(apiOutputTemplate("error", req.params.event_id + ' is not found'));

			// permission checked on passport

			foundUser.events = foundUser.events.filter(function (eventId) {
				return eventId != req.params.event_id;
			});
			foundUser.save(function (err, savedFoundUser) {
				if (err) console.log(err);
				if (!savedFoundUser) return res.json(apiOutputTemplate("error", 'savedFoundUser is undefined'));

				foundEvent.remove(function (err, removedFoundEvent) {
					if (err) console.log(err);
					if (!removedFoundEvent) return res.json(apiOutputTemplate("error", 'removedFoundEvent is undefined'));

					Event.populate(savedFoundUser, {
						path: "events",
						populate: [{
							path: "eventHosts",
							model: "User",
							select: "profile.name profile.gender profile.location profile.avatar",
							populate: {
								path: "profile.avatar",
								model: "Photo",
								select: "photoURL highresURL"
							}
						}, {
							path: "photos",
							model: "Photo",
							select: "photoURL highresURL"
						}, {
							path: "venue",
							model: "Venue",
							select: "name address1 address2 address3 city country phone"
						}]
					}, function (err, populatedSavedUser) {
						if (err) console.log(err);
						if (!populatedSavedUser) return res.json(apiOutputTemplate("error", 'populatedSavedUser is undefined'));

						return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedUser.events }));
					});
				});
			});
		});
	});
};

exports.postEventVenue = function (req, res) {
	var validationSchema = {
		"name": {
			notEmpty: true,
			isLength: {
				options: [{ max: 25 }],
				errorMessage: "The length of name should not exceed 25 characters."
			},
			errorMessage: "Name is required."
		},
		"address1": {
			notEmpty: true,
			isLength: {
				options: [{ max: 100 }],
				errorMessage: "The length of name should not exceed 100 characters."
			},
			errorMessage: "address1 is required."
		},
		"address2": {
			optional: true,
			isLength: {
				options: [{ max: 100 }],
				errorMessage: "The length of name should not exceed 100 characters."
			},
			errorMessage: "address2 is required."
		},
		"address3": {
			optional: true,
			isLength: {
				options: [{ max: 100 }],
				errorMessage: "The length of name should not exceed 100 characters."
			},
			errorMessage: "address3 is required."
		},
		"city": {
			optional: true,
			isLength: {
				options: [{ max: 50 }],
				errorMessage: "The length of name should not exceed 50 characters."
			},
			errorMessage: "city is required."
		},
		"country": {
			optional: true,
			isLength: {
				options: [{ max: 50 }],
				errorMessage: "The length of name should not exceed 50 characters."
			},
			errorMessage: "country is required."
		},
		"phone": {
			optional: true,
			isNumeric: {
				errorMessage: "Phone should only contains number"
			},
			isLength: {
				options: [{ max: 11, min: 8 }],
				errorMessage: "The length of phone should not exceed 11 characters"
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();

		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		req.sanitize('name').escape();
		req.sanitize('name').trim();
		req.sanitize('address1').escape();
		req.sanitize('address1').trim();
		req.sanitize('address2').escape();
		req.sanitize('address2').trim();
		req.sanitize('address3').escape();
		req.sanitize('address3').trim();
		req.sanitize('city').escape();
		req.sanitize('city').trim();
		req.sanitize('country').escape();
		req.sanitize('country').trim();

		Event.findById(req.params.event_id, function (err, foundEvent) {
			if (err) console.log(err);
			if (!foundEvent) return res.json(apiOutputTemplate("error", 'foundEvent is undefined'));

			for (var i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
				if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", '403 Forbidden: No permission'));
			}

			var body = req.body;

			var venue = new Venue({
				name: body.name,
				address1: body.address1,
				address2: body.address2,
				address3: body.address3,
				city: body.city,
				country: body.country
			});
			venue.events.push(req.params.event_id);
			venue.save(function (err, savedVenue) {
				if (err) console.log(err);
				if (!savedVenue) return res.json(apiOutputTemplate("error", 'savedVenue is undefined'));

				foundEvent.venue = savedVenue._id;
				foundEvent.save(function (err, savedFoundEvent) {
					if (err) console.log(err);
					if (!savedFoundEvent) return res.json(apiOutputTemplate("error", 'savedFoundEvent is undefined'));

					Venue.populate(savedFoundEvent, [{
						path: "venue",
						select: "name address1 address2 address3 city country phone"
					}, {
						path: "eventHosts",
						model: "User",
						select: "profile.name profile.gender profile.location profile.avatar",
						populate: {
							path: "profile.avatar",
							model: "Photo",
							select: "photoURL highresURL"
						}
					}, {
						path: "photos",
						model: "Photo",
						select: "photoURL highresURL"
					}], function (err, populatedSavedFoundEvent) {
						if (err) console.log(err);
						if (!populatedSavedFoundEvent) return res.json(apiOutputTemplate("error", 'populatedSavedFoundEvent is undefined'));

						return res.json(apiOutputTemplate("success", 'success', { events: populatedSavedFoundEvent }));
					});
				});
			});
		});
	});
};

exports.postEventAttendance = function (req, res) {
	Event.findById(req.params.event_id, function (err, foundEvent) {
		if (err) console.log(err);
		if (!foundEvent) return res.json(apiOutputTemplate("error", 'foundEvent is undefined'));

		if (foundEvent.attendance.map(function (ele) {
			return ele.member.toString();
		}).indexOf(req.user.id) !== -1) return res.json(apiOutputTemplate("error", 'You have already joined'));

		// create an object with interested field, mongoose will create another field in this object
		foundEvent.attendance.push({ member: req.user.id });
		foundEvent.save(function (err, savedFoundEvent) {
			if (err) console.log(err);
			if (!savedFoundEvent) return res.json(apiOutputTemplate("error", 'savedFoundEvent is undefined'));

			User.findById(req.user.id, function (err, foundUser) {
				if (err) console.log(err);
				if (!foundUser) return res.json(apiOutputTemplate("error", 'foundUser is undefined'));

				// because of updated scheme
				if (!foundUser.joinedEvents) foundUser.joinedEvents = [];
				// because of updated scheme
				foundUser.joinedEvents.push(foundEvent.id);

				foundUser.save(function (err, savedFoundUser) {
					if (err) console.log(err);
					if (!savedFoundUser) return res.json(apiOutputTemplate("error", 'savedFoundUser is undefined'));

					return res.json(apiOutputTemplate("success", 'success', {
						eventId: savedFoundEvent.id,
						userId: savedFoundUser.id
					}));
				});
			});
		});
	});
};

exports.deleteEventAttendance = function (req, res) {
	Event.findById(req.params.event_id, function (err, foundEvent) {
		if (err) console.log(err);
		if (!foundEvent) return res.json(apiOutputTemplate("error", 'foundEvent is undefined'));

		if (foundEvent.attendance.map(function (ele) {
			return ele.member.toString();
		}).indexOf(req.user.id) === -1) return res.json(apiOutputTemplate("error", 'You did not join the event yet.'));

		foundEvent.attendance = foundEvent.attendance.filter(function (attendance) {
			return String(attendance.member) !== req.user.id;
		});
		foundEvent.save(function (err, savedFoundEvent) {
			if (err) console.log(err);
			if (!savedFoundEvent) return res.json(apiOutputTemplate("error", 'savedFoundEvent is undefined'));

			User.findById(req.user.id, function (err, foundUser) {
				if (err) console.log(err);
				if (!foundUser) return res.json(apiOutputTemplate("error", 'foundUser is undefined'));

				// because of updated scheme
				if (!foundUser.joinedEvents) foundUser.joinedEvents = [];
				// because of updated scheme
				foundUser.joinedEvents = foundUser.joinedEvents.filter(function (joinedEvent) {
					return String(joinedEvent) !== foundEvent.id;
				});
				foundUser.save(function (err, savedFoundUser) {
					if (err) console.log(err);
					if (!savedFoundUser) return res.json(apiOutputTemplate("error", 'savedFoundUser is undefined'));

					return res.json(apiOutputTemplate("success", 'success', {
						eventId: savedFoundEvent.id,
						userId: savedFoundUser.id
					}));
				});
			});
		});
	});
};

exports.postEventComment = function (req, res) {
	var validationSchema = {
		"title": {
			optional: true,
			isLength: {
				options: [{ max: 100 }],
				errorMessage: "The length of title should not exceed 100 characters."
			},
			errorMessage: "Title is required."
		},
		"comment": {
			notEmpty: true,
			isLength: {
				options: [{ max: 300 }],
				errorMessage: "The length of name should not exceed 300 characters."
			},
			errorMessage: "Comment is required."
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();
		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}
		req.sanitize('title').escape();
		req.sanitize('title').trim();
		req.sanitize('comment').escape();
		req.sanitize('comment').trim();

		Event.findById(req.params.event_id, function (err, foundEvent) {
			if (err) console.log(err);
			if (!foundEvent) return res.json(apiOutputTemplate("error", 'foundEvent is undefined'));

			var body = req.body;
			var comment = new EventComment({
				title: body.title,
				comment: body.comment,
				member: req.user.id
			});
			comment.save(function (err, savedComment) {
				if (err) console.log(err);
				if (!savedComment) return res.json(apiOutputTemplate('error', 'savedComment is undefined'));

				foundEvent.comments.push(savedComment.id);
				foundEvent.save(function (err, savedFoundEvent) {
					if (err) console.log(err);
					if (!savedFoundEvent) return res.json(apiOutputTemplate("error", 'savedFoundEvent is undefined'));

					return res.json(apiOutputTemplate("success", 'success', {
						eventId: savedFoundEvent.id,
						commentId: savedComment.id
					}));
				});
			});
		});
	});
};

exports.postEventRating = function (req, res) {
	var validationSchema = {
		"rating": {
			notEmpty: true,
			isIn: {
				options: [[1, 2, 3, 4, 5]],
				errorMessage: 'rating should only be one of the [' + [1, 2, 3, 4, 5].toString() + ']'
			}
		}
	};

	req.checkBody(validationSchema);
	req.getValidationResult().then(function (result) {
		var errors = result.array();
		if (!result.isEmpty()) {
			return res.json(apiOutputTemplate("error", errors));
		}

		EventRating.find({ eventId: req.params.event_id, member: req.user.id }, function (err, foundEventRatings) {
			if (err) console.log(err);

			if (foundEventRatings.length !== 0) return res.json(apiOutputTemplate("error", 'You have already rated to this event.'));

			Event.findById(req.params.event_id, function (err, foundEvent) {
				if (err) console.log(err);
				if (!foundEvent) return res.json(apiOutputTemplate("error", 'foundEvent is undefined'));

				var body = req.body;
				var rating = new EventRating({
					eventId: foundEvent.id,
					rating: body.rating,
					member: req.user.id
				});
				rating.save(function (err, savedRating) {
					if (err) console.log(err);
					if (!savedRating) return res.json(apiOutputTemplate('error', 'savedRating is undefined'));

					EventRating.find({ eventId: foundEvent.id }, function (err, foundEventRatings) {
						if (err) console.log(err);
						if (!savedRating) return res.json(apiOutputTemplate('error', 'foundEventRatings is undefined'));

						var count = foundEventRatings.length;
						var overall = foundEventRatings.map(function (ele) {
							return ele.rating;
						}).reduce(function (acc, rating) {
							return acc + rating;
						}) / count;

						foundEvent.rating.count = count;
						foundEvent.rating.overall = Math.round(overall * 10) / 10;

						foundEvent.save(function (err, savedFoundEvent) {
							if (err) console.log(err);
							if (!savedRating) return res.json(apiOutputTemplate('error', 'savedFoundEvent is undefined'));

							return res.json(apiOutputTemplate("success", 'success', {
								rating: {
									count: savedFoundEvent.rating.count,
									overall: savedFoundEvent.rating.overall
								}
							}));
						});
					});
				});
			});
		});
	});
};

exports.getEventsFind = function (req, res) {
	Event.find({}).populate([{
		path: "eventHosts",
		model: "User",
		select: "profile.name profile.gender profile.location profile.avatar",
		populate: {
			path: "profile.avatar",
			model: "Photo",
			select: "photoURL highresURL"
		}
	}, {
		path: "photos",
		model: "Photo",
		select: "photoURL highresURL"
	}, {
		path: "venue",
		model: "Venue",
		select: "name address1 address2 address3 city country phone"
	}, {
		path: 'attendance.member',
		model: 'User',
		select: 'profile.name profile.gender profile.avatar',
		populate: {
			path: "profile.avatar",
			model: "Photo",
			select: "photoURL highresURL"
		}
	}, {
		path: 'comments',
		model: 'EventComment',
		select: 'title comment member createdAt',
		populate: {
			path: "member",
			model: "User",
			select: "profile.name profile.gender profile.avatar",
			populate: {
				path: "profile.avatar",
				model: "Photo",
				select: "photoURL highresURL"
			}
		}
	}]).exec(function (err, foundEvents) {
		if (err) console.log(err);
		if (!foundEvents) return res.json(apiOutputTemplate("error", 'foundEvents is undefined'));

		return res.json(apiOutputTemplate("success", 'success', { events: foundEvents }));
	});
};

var googlePlaces = require("googleplaces");
var googlePlacesAPI = googlePlaces(process.env.GOOGLE_PLACE_API_KEY, "json");

exports.test = function (req, res) {
	var parameters = void 0;

	// parameters = {
	//     query:"restaurants"
	// };
	// googlePlacesAPI.textSearch(parameters, function (err, response) {
	//     return res.json(apiOutputTemplate("success", 'success', {response: response}));
	// });

	// parameters = {
	//     input:"fanling"
	// };
	// googlePlacesAPI.placeAutocomplete(parameters, function (err, response) {
	//     return res.json(apiOutputTemplate("success", 'success', {...response}));
	// });

	parameters = {
		query: "fanling"
	};

	googlePlacesAPI.textSearch(parameters, function (error, response) {
		if (error) throw error;
		googlePlacesAPI.placeDetailsRequest({ reference: response.results[0].reference }, function (error, response) {
			if (error) throw error;
			return res.json(apiOutputTemplate("success", 'success', _extends({}, response)));
		});
	});

	// parameters = {
	//     location:[-33.8670522, 151.1957362],
	//     types:"doctor"
	// };
	// googlePlacesAPI.placeSearch(parameters, function (response) {
	//     googlePlacesAPI.placeDetailsRequest({reference:response.results[0].reference}, function (response) {
	//         console.log(response.result);
	//     });
	// });
};

/**
 * GET /api
 * List of API examples.
 */
exports.getApi = function (req, res) {
	res.render('api/index', {
		title: 'API Examples'
	});
};

/**
 * GET /api/foursquare
 * Foursquare API example.
 */
exports.getFoursquare = function (req, res, next) {
	var token = req.user.tokens.find(function (token) {
		return token.kind === 'foursquare';
	});
	async.parallel({
		trendingVenues: function trendingVenues(callback) {
			foursquare.Venues.getTrending('40.7222756', '-74.0022724', { limit: 50 }, token.accessToken, function (err, results) {
				callback(err, results);
			});
		},
		venueDetail: function venueDetail(callback) {
			foursquare.Venues.getVenue('49da74aef964a5208b5e1fe3', token.accessToken, function (err, results) {
				callback(err, results);
			});
		},
		userCheckins: function userCheckins(callback) {
			foursquare.Users.getCheckins('self', null, token.accessToken, function (err, results) {
				callback(err, results);
			});
		}
	}, function (err, results) {
		if (err) {
			return next(err);
		}
		res.render('api/foursquare', {
			title: 'Foursquare API',
			trendingVenues: results.trendingVenues,
			venueDetail: results.venueDetail,
			userCheckins: results.userCheckins
		});
	});
};

/**
 * GET /api/facebook
 * Facebook API example.
 */
exports.getFacebook = function (req, res, next) {
	var token = req.user.tokens.find(function (token) {
		return token.kind === 'facebook';
	});
	graph.setAccessToken(token.accessToken);
	graph.get(req.user.facebook + '?fields=id,name,email,first_name,last_name,gender,link,locale,timezone', function (err, results) {
		if (err) {
			return next(err);
		}
		res.render('api/facebook', {
			title: 'Facebook API',
			profile: results
		});
	});
};

/**
 * GET /api/aviary
 * Aviary image processing example.
 */
exports.getAviary = function (req, res) {
	res.render('api/aviary', {
		title: 'Aviary API'
	});
};

/**
 * GET /api/upload
 * File Upload API example.
 */

exports.getFileUploadWeb = function (req, res) {
	res.render('api/uploadWeb', {
		title: 'File Upload'
	});
};

exports.postFileUploadWeb = function (req, res) {
	req.flash('success', { msg: 'File was uploaded successfully.' });
	res.redirect('/api/uploadWeb');
};

exports.getGoogleMaps = function (req, res) {
	res.render('api/google-maps', {
		title: 'Google Maps API'
	});
};