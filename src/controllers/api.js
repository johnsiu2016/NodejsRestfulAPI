'use strict';

const User = require('../models/User');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const myUtil = require('../myUtil');
const apiOutputTemplate = myUtil.apiOutputTemplate;
const moment = require('moment');
import path from 'path';
import fs from 'fs';

const async = require('async');
const graph = require('fbgraph');
const foursquare = require('node-foursquare')({
    secrets: {
        clientId: process.env.FOURSQUARE_ID,
        clientSecret: process.env.FOURSQUARE_SECRET,
        redirectUrl: process.env.FOURSQUARE_REDIRECT_URL
    }
});

// Sign Up
exports.postSignup = (req, res) => {
    const validationSchema = {
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
                options: [{min: 6, max: 100}],
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
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        const user = new User({
            email: req.body.email,
            password: req.body.password
        });

        User.findOne({email: req.body.email}, (err, existingUser) => {
            if (err) console.log(err);

            if (existingUser) {
                return res.json(apiOutputTemplate("error", 'Account with that email address already exists.'));
            }

            user.save((err) => {
                if (err) {
                    console.log(err);
                }

                const jwtToken = jwt.sign({
                    id: user.id
                }, process.env.JWTSECRET);

                return res.json(apiOutputTemplate("success", 'Successfully signed up', {
                    token: `JWT ${jwtToken}`,
                    id: user.id
                }));
            });
        });
    });
};

// Log in
exports.postLogin = (req, res) => {
    const validationSchema = {
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
                options: [{min: 6, max: 100}],
                errorMessage: "Password must be at least 6 characters long"
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        passport.authenticate('local', (err, user, info) => {
            if (err) console.log(err);

            if (!user) {
                return res.json(apiOutputTemplate("error", info.msg));
            }

            const jwtToken = jwt.sign({
                id: user.id
            }, process.env.JWTSECRET);

            return res.json(apiOutputTemplate("success", "Successfully logged in.", {
                token: `JWT ${jwtToken}`,
                id: user.id
            }));

        })(req, res);
    });
};

// Get Account Profile
exports.getMemberProfile = (req, res) => {
    Photo.populate(req.user, {
        path: "profile.photos profile.avatar",
        select: "photoURL highresURL"
    }, (err, populatedUser) => {
        if (err) return res.json(apiOutputTemplate("error", err.errors));

        return res.json(apiOutputTemplate("success", 'success', {
            email: req.user.email,
            profile: populatedUser.profile
        }));
    });
};

// Update Account Profile
exports.patchMemberProfile = (req, res) => {

    req.sanitize('name').escape();
    req.sanitize('name').trim();
    req.sanitize('location').escape();
    req.sanitize('location').trim();

    // mongoose array no indexof method.
    const tmpPhotos = [];
    req.user.profile.photos.forEach((photo) => {
        tmpPhotos.push(photo);
    });

    const validationSchema = {
        "email": {
            optional: true,
            isEmail: {
                errorMessage: "Please enter a valid email address."
            }
        },
        "name": {
            optional: true,
            isLength: {
                options: [{max: 15}],
                errorMessage: "The length of name should not exceed 15 characters"
            }
        },
        "gender": {
            optional: true,
            isIn: {
                options: [['male', 'female', 'other']],
                errorMessage: `Gender should only be one of the [${['male', 'female', 'other'].toString()}]`
            }
        },
        "location": {
            optional: true,
            isLength: {
                options: [{max: 150}],
                errorMessage: "The length of location should not exceed 150 characters"
            },
        },
        "phone": {
            optional: true,
            isNumeric: {
                errorMessage: "Phone should only contains number"
            },
            isLength: {
                options: [{max: 11, min: 8}],
                errorMessage: "The length of phone should not exceed 11 characters"
            }
        },
        "website": {
            optional: true,
            isURL: {
                errorMessage: "Please enter a URL."
            },
            isLength: {
                options: [{max: 200}],
                errorMessage: "The length of website should not exceed 200 characters"
            }
        },
        "avatar": {
            optional: true,
            isIn: {
                options: [tmpPhotos],
                errorMessage: `Avatar should only be one of the [${tmpPhotos.toString()}]`
            },
            isLength: {
                options: [{max: 200}],
                errorMessage: "The length of website should not exceed 200 characters"
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        let user = req.user;
        let profile = req.user.profile;
        let body = req.body;

        user.email = body.email || user.email;
        profile.name = body.name || profile.name;
        profile.gender = body.gender || profile.gender;
        profile.location = body.location || profile.location;
        profile.phone = body.phone || profile.phone;
        profile.website = body.website || profile.website;
        profile.avatar = body.avatar || profile.avatar;

        user.save((err, savedUser) => {
            if (err) {
                if (err.code === 11000) {
                    return res.json(apiOutputTemplate("error", 'The email address you have entered is already associated with an account.'));
                }
                console.log(err);
            }

            Photo.populate(savedUser, {
                path: "profile.photos profile.avatar",
                select: "photoURL highresURL"
            }, (err, populatedSavedUser) => {
                if (err) return res.json(apiOutputTemplate("error", err.errors));

                return res.json(apiOutputTemplate("success", 'success', {profile: populatedSavedUser.profile}));
            });
        });
    });
};

exports.postMemberPhoto = (req, res) => {
    if (req.user.profile.photos.length >= 8) {
        return res.json(apiOutputTemplate("error", "profile.photos exceeds the limit of 8"));
    }

    myUtil.photoUpload(req, res, (savedPhoto) => {
        if (!savedPhoto) return res.json(apiOutputTemplate("error", `savedPhoto is undefined`));

        const user = req.user;
        const profile = req.user.profile;

        if (!profile.avatar) {
            profile.avatar = savedPhoto._id;
        }
        user.profile.photos.push(savedPhoto._id);
        user.save((err, savedUser) => {
            if (err) console.log(err);
            if (!savedUser) return res.json(apiOutputTemplate("error", `savedUser is undefined`));

            Photo.populate(savedUser, {
                path: "profile.photos profile.avatar",
                select: "photoURL highresURL"
            }, (err, populatedSavedUser) => {
                if (err) return res.json(apiOutputTemplate("error", err.errors));

                return res.json(apiOutputTemplate("success", 'success', {profile: populatedSavedUser.profile}));
            });
        });
    });
};

// delete method do not have user found in passport now
exports.deleteMemberPhoto = (req, res) => {
    // one to one ref delete
    // delete photo doc and delete actual photo
    myUtil.photoDelete(req, res, () => {
        // delete user doc
        // use findById, because I need to update avatar using current value but single update operation does not provide current field value
        User.findById(req.params.member_id, (err, foundUser) => {
            if (err) console.log(err);
            if (!foundUser) return res.json(apiOutputTemplate("error", `${req.params.member_id} is not found`));

            let profile = foundUser.profile;
            profile.photos = profile.photos.filter((photo) => photo != req.params.photo_id);
            // use double equal, because javascript string type != mongoose string type
            if (req.params.photo_id == profile.avatar) {
                profile.avatar = profile.photos[0];
            }
            foundUser.save((err, savedUser) => {
                if (err) console.log(err);
                if (!savedUser) return res.json(apiOutputTemplate("error", `savedUser is undefined`));

                Photo.populate(savedUser, {
                    path: "profile.photos profile.avatar",
                    select: "photoURL highresURL"
                }, (err, populatedSavedUser) => {
                    if (err) return res.json(apiOutputTemplate("error", err.errors));

                    return res.json(apiOutputTemplate("success", 'success', {profile: populatedSavedUser.profile}));
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

exports.postEventPhoto = (req, res) => {
    Event.findById(req.params.event_id, (err, foundEvent) => {
        if (err) console.log(err);
        if (!foundEvent) return res.json(apiOutputTemplate("error", `${req.params.event_id} is not found`));

        for (let i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
            if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", `403 Forbidden: No permission`));
        }

        if (foundEvent.photos.length >= 8) {
            return res.json(apiOutputTemplate("error", "Photos exceeds the limit of 8"));
        }

        myUtil.photoUpload(req, res, (savedPhoto) => {
            foundEvent.photos.push(savedPhoto._id);
            foundEvent.save((err, savedEvent) => {
                if (err) console.log(err);
                if (!savedEvent) return res.json(apiOutputTemplate("error", `savedEvent is undefined`));

                Photo.populate(savedEvent, {
                    path: "photos",
                    select: "photoURL highresURL"
                }, (err, populatedSavedEvent) => {
                    if (err) console.log(err);
                    if (!savedEvent) return res.json(apiOutputTemplate("error", `populatedSavedEvent is undefined`));

                    return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedEvent}));
                });
            });
        });
    });
};

// delete method do not have user found in passport now
exports.deleteEventPhoto = (req, res) => {
    // delete user doc
    // use findById, because I need to update avatar using current value but single update operation does not provide current field value
    Event.findById(req.params.event_id, (err, foundEvent) => {
        if (err) console.log(err);
        if (!foundEvent) return res.json(apiOutputTemplate("error", `${req.params.event_id} is not found`));

        for (let i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
            if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", `403 Forbidden: No permission`));
        }

        myUtil.photoDelete(req, res, () => {
            foundEvent.photos = foundEvent.photos.filter((photo) => photo != req.params.photo_id);
            foundEvent.save((err, savedEvent) => {
                if (err) console.log(err);

                Photo.populate(savedEvent, {
                    path: "photos",
                    select: "photoURL highresURL"
                }, (err, populatedSavedEvent) => {
                    if (err) console.log(err);
                    if (!savedEvent) return res.json(apiOutputTemplate("error", `populatedSavedEvent is undefined`));

                    return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedEvent}));
                });
            });
        });
    });

};

exports.getMemberEventsList = (req, res) => {
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
        }]
    }, (err, populatedUser) => {
        if (err) console.log(err);
        if (!populatedUser) return res.json(apiOutputTemplate("error", `populatedUser is undefined`));

        return res.json(apiOutputTemplate("success", 'success', {events: populatedUser.events}));
    });
};

exports.getMemberEvent = (req, res) => {
    Event.findById(req.params.event_id, (err, foundEvent) => {
        if (err) console.log(err);
        if (!foundEvent) return res.json(apiOutputTemplate("error", `${req.params.event_id} is not found`));

        Photo.populate(foundEvent, {
            path: "photos",
            select: "photoURL highresURL"
        }, (err, populatedEvent) => {
            if (err) console.log(err);
            if (!populatedEvent) return res.json(apiOutputTemplate("error", `populatedEvent is undefined`));

            return res.json(apiOutputTemplate("success", 'success', {events: populatedEvent}));
        });
    });
};

myUtil.configNumeral();
const numeral = require('numeral');

exports.postMemberEvent = (req, res) => {
    const validationSchema = {
        "name": {
            notEmpty: true,
            isLength: {
                options: [{max: 25}],
                errorMessage: "The length of name should not exceed 25 characters."
            },
            errorMessage: "Name is required."
        },
        "description": {
            notEmpty: true,
            isLength: {
                options: [{max: 200}],
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
            },
            errorMessage: "Duration is required."
        },
        "fee": {
            isNumeric: {
                errorMessage: "Fee is not valid."
            }
        },
        "status": {
            isIn: {
                options: [["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]],
                errorMessage: `status should be one of the value of the list ${["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]}.`
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        req.sanitize('name').escape();
        req.sanitize('name').trim();
        req.sanitize('description').escape();
        req.sanitize('description').trim();

        let user = req.user;
        let body = req.body;

        let event = new Event({
            name: body.name,
            description: body.description,
            time: moment(req.body.time).format("dddd, MMMM Do YYYY, h:mm:ss a"),
            duration: myUtil.processTimeDuration(body.duration),
            eventHosts: [user._id],
            fee: numeral(body.fee).format('$0,0'),
            status: body.status
        });

        event.save((err, savedEvent) => {
            if (err) console.log(err);
            if (!savedEvent) return res.json(apiOutputTemplate("error", `savedEvent is undefined`));

            user.events.push(savedEvent._id);
            user.save((err, savedUser) => {
                if (err) console.log(err);
                if (!savedUser) return res.json(apiOutputTemplate("error", `savedUser is undefined`));

                Event.populate(savedUser, {
                    path: "events"
                }, (err, populatedSavedUser) => {
                    if (err) console.log(err);
                    if (!populatedSavedUser) return res.json(apiOutputTemplate("error", `populatedSavedUser is undefined`));

                    return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedUser.events}));
                });
            });
        });
    });
};

exports.patchMemberEvent = (req, res) => {
    const validationSchema = {
        "name": {
            notEmpty: true,
            isLength: {
                options: [{max: 25}],
                errorMessage: "The length of name should not exceed 25 characters."
            },
            errorMessage: "Name is required."
        },
        "description": {
            notEmpty: true,
            isLength: {
                options: [{max: 200}],
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
            },
            errorMessage: "Duration is required."
        },
        "fee": {
            isNumeric: {
                errorMessage: "Fee is not valid."
            }
        },
        "status": {
            isIn: {
                options: [["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]],
                errorMessage: `status should be one of the value of the list ${["cancelled", "upcoming", "past", "proposed", "suggested", "draft"]}.`
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        req.sanitize('name').escape();
        req.sanitize('name').trim();
        req.sanitize('description').escape();
        req.sanitize('description').trim();

        Event.findById(req.params.event_id, (err, foundEvent) => {
            if (err) console.log(err);
            if (!foundEvent) return res.json(apiOutputTemplate("error", `${req.params.event_id} is not found`));

            let body = req.body;
            foundEvent.name = body.name;
            foundEvent.description = body.description;
            foundEvent.time = moment(req.body.time).format("dddd, MMMM Do YYYY, h:mm:ss a");
            foundEvent.duration = myUtil.processTimeDuration(body.duration);
            foundEvent.fee = numeral(body.fee).format('$0,0');
            foundEvent.status = body.status;
            foundEvent.save((err, savedEvent) => {
                if (err) console.log(err);
                if (!savedEvent) return res.json(apiOutputTemplate("error", `savedEvent is undefined`));

                Photo.populate(savedEvent, {
                    path: "photos",
                    select: "photoURL highresURL"
                }, (err, populatedSavedEvent) => {
                    if (err) console.log(err);
                    if (!savedEvent) return res.json(apiOutputTemplate("error", `populatedSavedEvent is undefined`));

                    return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedEvent}));
                });
            });
        });
    });
};

exports.deleteMemberEvent = (req, res) => {
    User.findById(req.user.id, (err, foundUser) => {
        if (err) console.log(err);
        if (!foundUser) return res.json(apiOutputTemplate("error", `${req.user.id} is not found`));

        Event.findById(req.params.event_id, (err, foundEvent) => {
            if (err) console.log(err);
            if (!foundEvent) return res.json(apiOutputTemplate("error", `${req.params.event_id} is not found`));

            // permission checked on passport

            foundUser.events = foundUser.events.filter((eventId) => eventId != req.params.event_id);
            foundUser.save((err, savedFoundUser) => {
                if (err) console.log(err);
                if (!savedFoundUser) return res.json(apiOutputTemplate("error", `savedFoundUser is undefined`));

                foundEvent.remove((err, removedFoundEvent) => {
                    if (err) console.log(err);
                    if (!removedFoundEvent) return res.json(apiOutputTemplate("error", `removedFoundEvent is undefined`));

                    Event.populate(savedFoundUser, {
                        path: "events"
                    }, (err, populatedSavedFoundUser) => {
                        if (err) console.log(err);
                        if (!populatedSavedFoundUser) return res.json(apiOutputTemplate("error", `populatedSavedFoundUser is undefined`));

                        return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedFoundUser.events}));
                    });
                });
            });
        });
    });
};

exports.postEventVenue = (req, res) => {
    const validationSchema = {
        "name": {
            notEmpty: true,
            isLength: {
                options: [{max: 25}],
                errorMessage: "The length of name should not exceed 25 characters."
            },
            errorMessage: "Name is required."
        },
        "address1": {
            notEmpty: true,
            isLength: {
                options: [{max: 100}],
                errorMessage: "The length of name should not exceed 100 characters."
            },
            errorMessage: "address1 is required."
        },
        "address2": {
            optional: true,
            isLength: {
                options: [{max: 100}],
                errorMessage: "The length of name should not exceed 100 characters."
            },
            errorMessage: "address2 is required."
        },
        "address3": {
            optional: true,
            isLength: {
                options: [{max: 100}],
                errorMessage: "The length of name should not exceed 100 characters."
            },
            errorMessage: "address3 is required."
        },
        "city": {
            optional: true,
            isLength: {
                options: [{max: 50}],
                errorMessage: "The length of name should not exceed 50 characters."
            },
            errorMessage: "city is required."
        },
        "country": {
            optional: true,
            isLength: {
                options: [{max: 50}],
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
                options: [{max: 11, min: 8}],
                errorMessage: "The length of phone should not exceed 11 characters"
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

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

        Event.findById(req.params.event_id, (err, foundEvent) => {
            if (err) console.log(err);
            if (!foundEvent) return res.json(apiOutputTemplate("error", `foundEvent is undefined`));

            for (let i = 0, len = foundEvent.eventHosts.length; i < len; i++) {
                if (foundEvent.eventHosts[i] != req.user.id) return res.json(apiOutputTemplate("error", `403 Forbidden: No permission`));
            }

            let body = req.body;

            let venue = new Venue({
                name: body.name,
                address1: body.address1,
                address2: body.address2,
                address3: body.address3,
                city: body.city,
                country: body.country,
            });
            venue.events.push(req.params.event_id);
            venue.save((err, savedVenue) => {
                if (err) console.log(err);
                if (!savedVenue) return res.json(apiOutputTemplate("error", `savedVenue is undefined`));

                foundEvent.venue = savedVenue._id;
                foundEvent.save((err, savedFoundEvent) => {
                    if (err) console.log(err);
                    if (!savedFoundEvent) return res.json(apiOutputTemplate("error", `savedFoundEvent is undefined`));

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
                    }], (err, populatedSavedFoundEvent) => {
                        if (err) console.log(err);
                        if (!populatedSavedFoundEvent) return res.json(apiOutputTemplate("error", `populatedSavedFoundEvent is undefined`));

                        return res.json(apiOutputTemplate("success", 'success', {events: populatedSavedFoundEvent}));
                    });
                });
            });
        });
    });
};

exports.getEventsFind = (req, res) => {
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
    }]).exec((err, foundEvents) => {
        if (err) console.log(err);
        if (!foundEvents) return res.json(apiOutputTemplate("error", `foundEvents is undefined`));

        return res.json(apiOutputTemplate("success", 'success', {events: foundEvents}));
    });
};

const googlePlaces = require("googleplaces");
const googlePlacesAPI = googlePlaces(process.env.GOOGLE_PLACE_API_KEY, "json");

exports.test = (req, res) => {
    let parameters;

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
        googlePlacesAPI.placeDetailsRequest({reference: response.results[0].reference}, function (error, response) {
            if (error) throw error;
            return res.json(apiOutputTemplate("success", 'success', {...response}));
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
exports.getApi = (req, res) => {
    res.render('api/index', {
        title: 'API Examples'
    });
};

/**
 * GET /api/foursquare
 * Foursquare API example.
 */
exports.getFoursquare = (req, res, next) => {
    const token = req.user.tokens.find(token => token.kind === 'foursquare');
    async.parallel({
            trendingVenues: (callback) => {
                foursquare.Venues.getTrending('40.7222756', '-74.0022724', {limit: 50}, token.accessToken, (err, results) => {
                    callback(err, results);
                });
            },
            venueDetail: (callback) => {
                foursquare.Venues.getVenue('49da74aef964a5208b5e1fe3', token.accessToken, (err, results) => {
                    callback(err, results);
                });
            },
            userCheckins: (callback) => {
                foursquare.Users.getCheckins('self', null, token.accessToken, (err, results) => {
                    callback(err, results);
                });
            }
        },
        (err, results) => {
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
exports.getFacebook = (req, res, next) => {
    const token = req.user.tokens.find(token => token.kind === 'facebook');
    graph.setAccessToken(token.accessToken);
    graph.get(`${req.user.facebook}?fields=id,name,email,first_name,last_name,gender,link,locale,timezone`, (err, results) => {
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
exports.getAviary = (req, res) => {
    res.render('api/aviary', {
        title: 'Aviary API'
    });
};

/**
 * GET /api/upload
 * File Upload API example.
 */

exports.getFileUploadWeb = (req, res) => {
    res.render('api/uploadWeb', {
        title: 'File Upload'
    });
};

exports.postFileUploadWeb = (req, res) => {
    req.flash('success', {msg: 'File was uploaded successfully.'});
    res.redirect('/api/uploadWeb');
};

exports.getGoogleMaps = (req, res) => {
    res.render('api/google-maps', {
        title: 'Google Maps API'
    });
};
