'use strict';

const User = require('../models/User');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const myUtil = require('../myUtil');
const apiOutputTemplate = myUtil.apiOutputTemplate;

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

                return res.json(apiOutputTemplate("success", 'Successfully signed up', {token: jwtToken}));
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

            return res.json(apiOutputTemplate("success", "Successfully logged in.", {token: jwtToken}));

        })(req, res);
    });
};

// File upload
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(process.cwd(), 'uploads'));
        },
        filename: function (req, file, cb) {
            const extension = path.extname(file.originalname).toLowerCase();
            const name = crypto.createHash('md5').update(`${file.originalname}${Date.now()}`).digest('hex').toLowerCase();
            cb(null, `${name}${extension}`);
        }
    }),
    fileFilter: function (req, file, cb) {
        const allowFiletypes = /jpeg|jpg|png/;
        const isAllowMimetype = allowFiletypes.test(file.mimetype);
        const isAllowExtension = allowFiletypes.test(path.extname(file.originalname).toLowerCase());

        if (isAllowMimetype && isAllowExtension) {
            return cb(null, true);
        }

        cb(`File upload only supports the following file types - ${allowFiletypes}`);
    },
    limits: {
        fileSize: 5 * 100000
    }
});

exports.postFileUpload = (req, res) => {
    upload.single('myFile')(req, res, (err) => {
        // This err is multer specific one, which sucks.
        if (err) {
            let message = "";
            // This err code is multer itself implementation, which is funny
            if (err.code === "LIMIT_FILE_SIZE") {
                message = "File size > 5MB"
            } else {
                // This is the message I passed from the above cb
                message = err;
            }

            return res.json(apiOutputTemplate("error", message));
        }

        const width = Number(req.body.width) || 320;
        const height = Number(req.body.height) || 240;

        const tmp = req.file.path.split(".");
        const outputPath = `${tmp[0]}_${width}_${height}_${Date.now()}.${tmp[1]}`;

        sharp.cache(false);
        sharp(req.file.path).resize(width, height).toFile(outputPath, (err, info) => {
            if (err) {
                return res.json(apiOutputTemplate("error", err, {info: info}));
            }

            fs.unlink(req.file.path, (err) => {
                if (err) console.log(err);
                const imageURL = `${req.protocol}://${req.get('host')}/uploads/${path.parse(outputPath).base}`;

                return res.json(apiOutputTemplate("success", 'success', {imageURL: imageURL}));
            });
        });
    });
};

// Get Account Profile
exports.getAccount = (req, res) => {
    const data = {
        email: req.user.email,
        userProfile: req.user.profile
    };
    return res.json(apiOutputTemplate("success", "success", data));
};

// Update Account Profile
exports.postUpdateProfile = (req, res) => {

    req.sanitize('name').escape();
    req.sanitize('name').trim();
    req.sanitize('location').escape();
    req.sanitize('location').trim();

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
                options: [{max: 11}],
                errorMessage: "The length of phone should not exceed 11 characters"
            }
        },
        "website": {
            optional: true,
            isURL: {
                errorMessage: "Please enter a URL."
            },
            isLength: {
                options: [{max: 150}],
                errorMessage: "The length of website should not exceed 150 characters"
            }
        }
    };

    req.checkBody(validationSchema);
    req.getValidationResult().then(function (result) {
        const errors = result.array();

        if (!result.isEmpty()) {
            return res.json(apiOutputTemplate("error", errors));
        }

        User.findById(req.user.id, (err, user) => {
            if (err) console.log(err);

            user.email = req.body.email || user.email;
            user.profile.name = req.body.name || user.profile.name;
            user.profile.gender = req.body.gender || user.profile.gender;
            user.profile.location = req.body.location || user.profile.location;
            user.profile.phone = req.body.phone || user.profile.phone;
            user.profile.website = req.body.website || user.profile.website;

            user.save((err) => {
                if (err) {
                    if (err.code === 11000) {
                        return res.json(apiOutputTemplate("error", 'The email address you have entered is already associated with an account.'));
                    }
                    console.log(err);
                }

                return res.json(apiOutputTemplate("success", 'Profile information has been updated.'));
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
