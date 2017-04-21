'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.apiOutputTemplate = apiOutputTemplate;
exports.createDirIfNotExists = createDirIfNotExists;
exports.mongoFieldUpperLimitValidation = mongoFieldUpperLimitValidation;
exports.processTimeDuration = processTimeDuration;
exports.configNumeral = configNumeral;
exports.photoUpload = photoUpload;
exports.photoDelete = photoDelete;
function apiOutputTemplate(type, message, data) {
    return {
        status: {
            type: type,
            message: message
        },
        response: _extends({}, data)
    };
}

var fs = require("fs");
function createDirIfNotExists(path, mask, cb) {
    if (typeof mask == 'function') {
        // allow the `mask` parameter to be optional
        cb = mask;
        mask = 511;
    }
    fs.mkdir(path, mask, function (err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
}

function mongoFieldUpperLimitValidation(upperLimit) {
    return function (field) {
        return field.length <= upperLimit;
    };
}

function processTimeDuration(hours) {
    hours = Number(hours);
    var days = 0;
    var hoursUnit = "hours";
    var daysUnit = "days";

    if (Number.isInteger(hours / 24)) {
        days = hours / 24;
    }

    if (hours === 1) hoursUnit = "hour";
    if (days === 1) daysUnit = "day";
    return days === 0 ? hours + ' ' + hoursUnit : days + ' ' + daysUnit;
}

var numeral = require('numeral');
function configNumeral() {
    numeral.register('locale', 'hk', {
        delimiters: {
            thousands: ',',
            decimal: '.'
        },
        abbreviations: {
            thousand: 'k',
            million: 'm',
            billion: 'b',
            trillion: 't'
        },
        currency: {
            symbol: 'HKD '
        }
    });

    numeral.locale('hk');
}

// File upload
var Photo = require('../models/Photo');
var multer = require('multer');
var sharp = require('sharp');
var crypto = require('crypto');
var path = require('path');

createDirIfNotExists(process.cwd() + '/uploads', function (err) {
    if (err) console.log(err);
});

var upload = exports.upload = multer({
    storage: multer.diskStorage({
        destination: function destination(req, file, cb) {
            cb(null, path.join(process.cwd(), 'uploads'));
        },
        filename: function filename(req, file, cb) {
            var extension = path.extname(file.originalname).toLowerCase();
            var name = crypto.createHash('md5').update('' + file.originalname + Date.now()).digest('hex').toLowerCase();
            var fileName = '' + name + extension;
            cb(null, fileName);
        }
    }),
    fileFilter: function fileFilter(req, file, cb) {
        var allowFiletypes = /jpeg|jpg|png/;
        var isAllowMimetype = allowFiletypes.test(file.mimetype);
        var isAllowExtension = allowFiletypes.test(path.extname(file.originalname).toLowerCase());

        if (isAllowMimetype && isAllowExtension) {
            return cb(null, true);
        }

        cb('File upload only supports the following file types - ' + allowFiletypes);
    },
    limits: {
        fileSize: 2 * 1000000
    }
});

// update photo doc and upload actual photo
function photoUpload(req, res, cb) {
    upload.single('photo')(req, res, function (err) {
        // This err is multer specific one, which sucks.
        if (err) {
            var message = "";
            // This err code is multer itself implementation, which is funny
            if (err.code === "LIMIT_FILE_SIZE") {
                message = "File size > 2MB";
            } else {
                // This is the message I passed from the above cb
                message = err;
            }

            return res.json(apiOutputTemplate("error", message));
        }

        if (!req.file) {
            return res.json(apiOutputTemplate("error", "Photo field is required."));
        }

        var width = Number(req.body.width) || 320;
        var height = Number(req.body.height) || 240;

        var tmp = req.file.path.split(".");
        var outputPath = tmp[0] + '_' + width + '_' + height + '.' + tmp[1];

        sharp.cache(false);
        sharp(req.file.path).resize(width, height).toFile(outputPath, function (err, info) {
            if (err) {
                return res.json(apiOutputTemplate("error", err, { info: info }));
            }

            var photoURL = req.protocol + '://' + req.get('host') + '/uploads/' + path.parse(outputPath).base;
            var highresURL = req.protocol + '://' + req.get('host') + '/uploads/' + path.parse(req.file.path).base;
            var baseUrl = req.protocol + '://' + req.get('host');

            var photo = new Photo({
                photoURL: photoURL,
                highresURL: highresURL,
                baseUrl: baseUrl,
                type: req.params.event_id ? "event" : "member"
            });

            photo.save(function (err, savedPhoto) {
                if (err) return console.log(err);

                cb(savedPhoto);
            });
        });
    });
}

// delete photo doc and delete actual photo
function photoDelete(req, res, cb) {
    var dirName = path.join(process.cwd(), 'uploads');

    Photo.findById(req.params.photo_id, function (err, foundPhoto) {
        if (!foundPhoto) return res.json(apiOutputTemplate("error", req.params.photo_id + ' is not found'));

        var photoURL = foundPhoto.photoURL;
        var highresURL = foundPhoto.highresURL;

        [photoURL, highresURL].forEach(function (URL) {
            var fileName = path.parse(URL).base;
            var filePath = path.join(dirName, fileName);

            fs.unlink(filePath, function (err) {
                if (err) console.log(err);
            });
        });

        foundPhoto.remove(function (err) {
            if (err) console.log(err);

            cb();
        });
    });
}