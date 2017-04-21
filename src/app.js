/**
 * Module dependencies.
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const MongoStore = require('connect-mongo')(session);
const flash = require('express-flash');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');
const sass = require('node-sass-middleware');
const myUtil = require('./myUtil');

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const userController = require('./controllers/user');
const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');
const adminController = require('./controllers/admin');

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
    console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
    process.exit();
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 7000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(expressStatusMonitor());
app.use(compression());
app.use(sass({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public')
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressValidator({
        customValidators: {
            arrayIsIn: function (providedArray, checkingArray) {
                if (checkingArray.length === 0) return false;
                const filtedArray = providedArray.filter((providedValue) => {
                    return checkingArray.indexOf(providedValue) < 0
                });
                return filtedArray.length === 0
            }
        }
    }
));
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
        url: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
        autoReconnect: true
    })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
    if (req.path.match(/\/api\/\w*/)) {
        next();
    } else {
        lusca.csrf()(req, res, next);
    }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});
app.use((req, res, next) => {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/login' &&
        req.path !== '/signup' && !req.path.match(/^\/auth/) && !req.path.match(/\./)) {
        req.session.returnTo = req.path;
    } else if (req.user &&
        req.path == '/account') {
        req.session.returnTo = req.path;
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public'), {maxAge: 31557600000}));
app.use("/uploads", express.static(path.join(process.cwd(), 'uploads')));

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);

app.get('/admin', adminController.getAdmin);
app.post('/admin/account/delete', adminController.postDeleteAccount);
app.post('/admin/event/delete', adminController.postDeleteEvent);
app.post('/admin/photo/delete', adminController.postDeletePhoto);

/**
 * API examples routes.
 */

const api = express.Router();
// api key gateway
api.use((req, res, next) => {
    const apikey = req.query.apikey || req.body.apikey || req.headers.apikey;
    if (apikey === process.env.APIKEY) next();
    else res.json(myUtil.apiOutputTemplate("error", "Unauthorized: API key is not correct"));
});
// account, User Model
api.post('/signup', apiController.postSignup);
api.post('/login', apiController.postLogin);

// profiles, User Model
api.get('/members/:member_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.getMemberProfile);
api.patch('/members/:member_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.patchMemberProfile);

// photos, Photo Model
api.post('/members/:member_id/photos', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postMemberPhoto);
api.delete('/members/:member_id/photos/:photo_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.deleteMemberPhoto);
// event photo
api.post('/events/:event_id/photos', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postEventPhoto);
api.delete('/events/:event_id/photos/:photo_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.deleteEventPhoto);

// events, Event Model
api.get('/members/:member_id/events', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.getMemberEventsList);
api.post('/members/:member_id/events', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postMemberEvent);
api.get('/members/:member_id/events/:event_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.getMemberEvent);
api.patch('/members/:member_id/events/:event_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.patchMemberEvent);
api.delete('/members/:member_id/events/:event_id', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.deleteMemberEvent);

api.post('/events/:event_id/venues', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postEventVenue);
api.post('/events/:event_id/attendance', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postEventAttendance);
api.delete('/events/:event_id/attendance', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.deleteEventAttendance);
api.post('/events/:event_id/comments', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postEventComment);
api.post('/events/:event_id/ratings', passport.authenticate('jwt', {failWithError: true, session: false}), apiController.postEventRating);


api.get('/events/find', apiController.getEventsFind);


api.get("/test", apiController.test);


api.use(handleAPIError);
app.use('/api', api);

function handleAPIError(err, req, res, next) {
    let message = "";
    switch (err.status) {
        case 401:
            message = "401 Unauthorized: JWT is not correct";
            break;
        case 403:
            message = "403 Forbidden: No permission";
            break;
        default:
            console.log(err);
            message = "Unknown error";
            break;
    }

    return res.json(myUtil.apiOutputTemplate("error", message));
}

app.get('/api', apiController.getApi);
app.get('/api/aviary', apiController.getAviary);
app.get('/api/foursquare', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFoursquare);
app.get('/api/facebook', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);
app.get('/api/uploadWeb', apiController.getFileUploadWeb);
app.post('/api/uploadWeb', apiController.postFileUploadWeb);
app.get('/api/google-maps', apiController.getGoogleMaps);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['email', 'user_location']}));
app.get('/auth/facebook/callback', passport.authenticate('facebook', {failureRedirect: '/login'}), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', {scope: 'profile email'}));
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/login'}), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', {failureRedirect: '/api'}), (req, res) => {
    res.redirect('/api/foursquare');
});

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */

app.listen(app.get('port'), () => {
    console.log('%s App is running at http://localhost:%d in %s mode', chalk.green('✓'), app.get('port'), app.get('env'));
    console.log('  Press CTRL-C to stop\n');
});

module.exports = app;
