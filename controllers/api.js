'use strict';

const User = require('../models/User');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

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
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        return res.json({
            status: {
                type: "error",
                message: errors
            }
        });
    }

    const user = new User({
        email: req.body.email,
        password: req.body.password
    });

    User.findOne({email: req.body.email}, (err, existingUser) => {
        if (err) console.log(err);

        if (existingUser) {
            return res.json({
                status: {
                    type: "error",
                    message: 'Account with that email address already exists.'
                }
            });
        }

        user.save((err) => {
            if (err) {
                console.log(err);
            }

            const jwtToken = jwt.sign({
                id: user.id
            }, process.env.JWTSECRET);

            return res.json({
                status: {
                    type: "success",
                    message: 'Successfully signed up'
                },
                token: jwtToken
            });
        });
    });
};

// Log in
exports.postLogin = (req, res) => {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        return res.json({
            status: {
                type: "error",
                message: errors
            }
        });
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) console.log(err);

        if (!user) {
            return res.json({
                status: {
                    type: "error",
                    message: info.msg
                }
            });
        }

        const jwtToken = jwt.sign({
            id: user.id
        }, process.env.JWTSECRET);

        return res.json({
            status: {
                type: "success",
                message: 'Successfully logged in.'
            },
            token: jwtToken
        });

    })(req, res);
};

// Account Profile
exports.getAccount = (req, res) => {
    passport.authenticate('jwt', (err, user, info) => {
        if (err) console.log(err);

        if (!user) {
            return res.json({
                status: {
                    type: "error",
                    message: info.msg || "UnAuthorization"
                }
            });
        }

        res.json({
            status: {
                type: "success",
                message: 'success'
            },
            email: user.email,
            userProfile: user.profile
        });

    })(req, res);
};

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

            return res.json({
                status: {
                    type: "error",
                    message: message
                }
            });
        }

        const width = Number(req.body.width) || 320;
        const height = Number(req.body.height) || 240;

        const tmp = req.file.path.split(".");
        const outputPath = `${tmp[0]}_${width}_${height}_${Date.now()}.${tmp[1]}`;

        sharp.cache(false);
        sharp(req.file.path).resize(width, height).toFile(outputPath, (err, info) => {
            if (err) {
                return res.json({
                    status: {
                        type: "error",
                        message: err
                    },
                    info: info
                });
            }

            fs.unlink(req.file.path, (err) => {
                if (err) console.log(err);
                const imageURL = `${req.protocol}://${req.get('host')}/uploads/${path.parse(outputPath).base}`;
                console.log(imageURL);
                return res.json({
                    status: {
                        type: "success",
                        message: 'success'
                    },
                    imageURL: imageURL
                });
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
