'use strict';

var _ = require('lodash');
var passport = require('passport');
var request = require('request');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;

var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;

var User = require('../models/User');

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeader(),
    secretOrKey: process.env.JWTSECRET,
    passReqToCallback: true
}, function (req, jwt_payload, done) {
    if (req.params.member_id) {
        // check route
        if (req.params.member_id === jwt_payload.id) {
            // member direct field permission
            if (req.method === "DELETE") {
                // find user in the route
                return done(null, jwt_payload);
            }

            User.findOne({ _id: jwt_payload.id }, function (err, user) {
                if (err) {
                    return done(err, false);
                }

                if (user) {
                    return done(null, user);
                } else {
                    return done(null, false, { msg: 'User of ID from JWT payload is not found.' });
                }
            });
        } else if (req.method === "GET") {
            User.findOne({ _id: req.params.member_id }, function (err, user) {
                if (err) {
                    return done(err, false);
                }

                if (user) {
                    return done(null, user);
                } else {
                    return done(null, false, { msg: 'User of ID from request params is not found.' });
                }
            });
        } else {
            return done({ status: 403 }, false);
        }
    } else {
        // non member direct field permission
        return done(null, jwt_payload);
    }
}));

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, function (email, password, done) {
    User.findOne({ email: email.toLowerCase() }, function (err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false, { msg: 'Invalid email or password.' });
        }
        user.comparePassword(password, function (err, isMatch) {
            if (err) {
                return done(err);
            }
            if (isMatch) {
                return done(null, user);
            }
            return done(null, false, { msg: 'Invalid email or password.' });
        });
    });
}));

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_ID,
    clientSecret: process.env.FACEBOOK_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['name', 'email', 'link', 'locale', 'timezone'],
    passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
    if (req.user) {
        User.findOne({ facebook: profile.id }, function (err, existingUser) {
            if (err) {
                return done(err);
            }
            if (existingUser) {
                req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
                done(err);
            } else {
                User.findById(req.user.id, function (err, user) {
                    if (err) {
                        return done(err);
                    }
                    user.facebook = profile.id;
                    user.tokens.push({ kind: 'facebook', accessToken: accessToken });
                    user.profile.name = user.profile.name || profile.name.givenName + ' ' + profile.name.familyName;
                    user.profile.gender = user.profile.gender || profile._json.gender;
                    user.profile.picture = user.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
                    user.save(function (err) {
                        req.flash('info', { msg: 'Facebook account has been linked.' });
                        done(err, user);
                    });
                });
            }
        });
    } else {
        User.findOne({ facebook: profile.id }, function (err, existingUser) {
            if (err) {
                return done(err);
            }
            if (existingUser) {
                return done(null, existingUser);
            }
            User.findOne({ email: profile._json.email }, function (err, existingEmailUser) {
                if (err) {
                    return done(err);
                }
                if (existingEmailUser) {
                    req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
                    done(err);
                } else {
                    var user = new User();
                    user.email = profile._json.email;
                    user.facebook = profile.id;
                    user.tokens.push({ kind: 'facebook', accessToken: accessToken });
                    user.profile.name = profile.name.givenName + ' ' + profile.name.familyName;
                    user.profile.gender = profile._json.gender;
                    user.profile.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
                    user.profile.location = profile._json.location ? profile._json.location.name : '';
                    user.save(function (err) {
                        done(err, user);
                    });
                }
            });
        });
    }
}));

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: '/auth/google/callback',
    passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
    if (req.user) {
        User.findOne({ google: profile.id }, function (err, existingUser) {
            if (err) {
                return done(err);
            }
            if (existingUser) {
                req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
                done(err);
            } else {
                User.findById(req.user.id, function (err, user) {
                    if (err) {
                        return done(err);
                    }
                    user.google = profile.id;
                    user.tokens.push({ kind: 'google', accessToken: accessToken });
                    user.profile.name = user.profile.name || profile.displayName;
                    user.profile.gender = user.profile.gender || profile._json.gender;
                    user.profile.picture = user.profile.picture || profile._json.image.url;
                    user.save(function (err) {
                        req.flash('info', { msg: 'Google account has been linked.' });
                        done(err, user);
                    });
                });
            }
        });
    } else {
        User.findOne({ google: profile.id }, function (err, existingUser) {
            if (err) {
                return done(err);
            }
            if (existingUser) {
                return done(null, existingUser);
            }
            User.findOne({ email: profile.emails[0].value }, function (err, existingEmailUser) {
                if (err) {
                    return done(err);
                }
                if (existingEmailUser) {
                    req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.' });
                    done(err);
                } else {
                    var user = new User();
                    user.email = profile.emails[0].value;
                    user.google = profile.id;
                    user.tokens.push({ kind: 'google', accessToken: accessToken });
                    user.profile.name = profile.displayName;
                    user.profile.gender = profile._json.gender;
                    user.profile.picture = profile._json.image.url;
                    user.save(function (err) {
                        done(err, user);
                    });
                }
            });
        });
    }
}));

/**
 * Foursquare API OAuth.
 */
passport.use('foursquare', new OAuth2Strategy({
    authorizationURL: 'https://foursquare.com/oauth2/authorize',
    tokenURL: 'https://foursquare.com/oauth2/access_token',
    clientID: process.env.FOURSQUARE_ID,
    clientSecret: process.env.FOURSQUARE_SECRET,
    callbackURL: process.env.FOURSQUARE_REDIRECT_URL,
    passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
    User.findById(req.user._id, function (err, user) {
        if (err) {
            return done(err);
        }
        user.tokens.push({ kind: 'foursquare', accessToken: accessToken });
        user.save(function (err) {
            done(err, user);
        });
    });
}));

/**
 * Login Required middleware.
 */
exports.isAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = function (req, res, next) {
    var provider = req.path.split('/').slice(-1)[0];

    if (_.find(req.user.tokens, { kind: provider })) {
        next();
    } else {
        res.redirect('/auth/' + provider);
    }
};