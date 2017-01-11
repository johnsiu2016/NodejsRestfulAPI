'use strict';

const User = require('../models/User');
const Photo = require('../models/Photo');
const Event = require('../models/Event');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const myUtil = require('../myUtil');
const apiOutputTemplate = myUtil.apiOutputTemplate;
const moment = require('moment');

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

                return res.json(apiOutputTemplate("success", 'Successfully signed up', {token: jwtToken, id: user.id}));
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

            return res.json(apiOutputTemplate("success", "Successfully logged in.", {token: jwtToken, id: user.id}));

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

exports.postMemberProfilePhoto = (req, res) => {
    let savedPhoto = myUtil.photoUpload(req, res);

    const user = req.user;
    const profile = req.user.profile;

    if (!profile.avatar) {
        profile.avatar = savedPhoto.id;
    }
    user.profile.photos.push(savedPhoto.id);

    user.save((err, savedUser) => {
        if (err) return res.json(apiOutputTemplate("error", err.errors));

        Photo.populate(savedUser, {
            path: "profile.photos profile.avatar",
            select: "photoURL highresURL"
        }, (err, populatedSavedUser) => {
            if (err) return res.json(apiOutputTemplate("error", err.errors));

            return res.json(apiOutputTemplate("success", 'success', {profile: populatedSavedUser.profile}));
        });
    });
};

// delete method do not have user found in passport now
exports.deleteMemberProfilePhoto = (req, res) => {
    const dirName = path.join(process.cwd(), 'uploads');

    Photo.findById(req.params.photo_id, (err, foundPhoto) => {
        if (!foundPhoto) return res.json(apiOutputTemplate("error", `${req.params.photo_id} is not found`));

        const photoURL = foundPhoto.photoURL;
        const highresURL = foundPhoto.highresURL;

        [photoURL, highresURL].forEach((URL) => {
            const fileName = path.parse(URL).base;
            const filePath = path.join(dirName, fileName);

            fs.unlink(filePath, (err) => {
                if (err) console.log(err);
            });
        });

        // delete method do not have user found in passport now
        foundPhoto.remove((err) => {
            if (err) console.log(err);

            // use findById, because I need to update avatar using current value but single update operation does not provide current field value
            User.findById(req.params.member_id, (err, foundUser) => {
                let profile = foundUser.profile;

                profile.photos = profile.photos.filter((photo) => photo != req.params.photo_id);
                // use double equal, because javascript string type != mongoose string type
                if (req.params.photo_id == profile.avatar) {
                    profile.avatar = profile.photos[0];
                }

                foundUser.save((err, savedUser) => {
                    if (err) console.log(err);

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
        })
    });
};

exports.getMemberEvents = (req, res) => {
    Event.populate(req.user, {
        path: "events"
    }, (err, populatedUser) => {
        if (err) return res.json(apiOutputTemplate("error", err.errors));

        return res.json(apiOutputTemplate("success", 'success', {events: populatedUser.events}));
    });
};

myUtil.configNumeral();
const numeral = require('numeral');

exports.postMemberEvents = (req, res) => {
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
            if (err) return console.log(err);
            user.events.push(savedEvent._id);
            user.save((err, savedUser) => {
                if (err) return console.log(err);
                return res.json(apiOutputTemplate("success", 'success', {events: savedUser.events}));
            });
        });
    });
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
