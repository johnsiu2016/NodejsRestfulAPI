const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const mongoFieldUpperLimitValidation = require("../myUtil").mongoFieldUpperLimitValidation;

const userSchema = new mongoose.Schema({
    email: {type: String, unique: true},
    password: String,
    passwordResetToken: String,
    passwordResetExpires: Date,

    facebook: String,
    twitter: String,
    google: String,
    github: String,
    instagram: String,
    linkedin: String,
    steam: String,
    tokens: Array,

    profile: {
        name: String,
        gender: {type: String, default: "male"},
        location: {type: String, default: "Hong Kong"},
        phone: String,
        website: String,
        avatar: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Photo"
        },
        photos: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Photo"
        }]
    },

    events: [{ // The event venue, present only if selected and not hidden by an organizer
        type: mongoose.Schema.Types.ObjectId,
        ref: "Photo"
    }],

}, {timestamps: true});

userSchema.path('profile.photos').validate(mongoFieldUpperLimitValidation(8), "{PATH} exceeds the limit of 8");

/**
 * Password hash middleware.
 */
userSchema.pre('save', function save(next) {
    const user = this;
    if (!user.isModified('password')) {
        return next();
    }
    bcrypt.genSalt(10, (err, salt) => {
        if (err) {
            return next(err);
        }
        bcrypt.hash(user.password, salt, null, (err, hash) => {
            if (err) {
                return next(err);
            }
            user.password = hash;
            next();
        });
    });
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function comparePassword(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        cb(err, isMatch);
    });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function gravatar(size) {
    if (!size) {
        size = 200;
    }
    if (!this.email) {
        return `https://gravatar.com/avatar/?s=${size}&d=retro`;
    }
    const md5 = crypto.createHash('md5').update(this.email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
