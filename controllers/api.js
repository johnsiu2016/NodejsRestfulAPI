'use strict';

const async = require('async');
const graph = require('fbgraph');
const foursquare = require('node-foursquare')({
    secrets: {
        clientId: process.env.FOURSQUARE_ID,
        clientSecret: process.env.FOURSQUARE_SECRET,
        redirectUrl: process.env.FOURSQUARE_REDIRECT_URL
    }
});

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

exports.getFileUpload = (req, res) => {
    res.render('api/upload', {
        title: 'File Upload'
    });
};

exports.postFileUpload = (req, res) => {
    req.flash('success', {msg: 'File was uploaded successfully.'});
    res.redirect('/api/upload');
};

exports.getGoogleMaps = (req, res) => {
    res.render('api/google-maps', {
        title: 'Google Maps API'
    });
};
