export function apiOutputTemplate(type, message, data) {
    return {
        status: {
            type: type,
            message: message
        },
        ...data
    }
}

const fs = require("fs");
export function createDirIfNotExists(path, mask, cb) {
    if (typeof mask == 'function') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0o777;
    }
    fs.mkdir(path, mask, function (err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
}

export function mongoFieldUpperLimitValidation(upperLimit) {
    return (field) => {
        return field.length <= upperLimit;
    };
}

export function processTimeDuration(hours) {
    hours = Number(hours);
    let days = 0;
    let hoursUnit = "hours";
    let daysUnit = "days";

    if (Number.isInteger(hours / 24)) {
        days = hours / 24;
    }

    if (hours === 1) hoursUnit = "hour";
    if (days === 1) daysUnit = "day";
    return days === 0 ? `${hours} ${hoursUnit}` : `${days} ${daysUnit}`;
}

const numeral = require('numeral');
export function configNumeral() {
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
const Photo = require('../models/Photo');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

createDirIfNotExists(process.cwd() + '/uploads', (err) => {
    if (err) console.log(err);
});

export const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(process.cwd(), 'uploads'));
        },
        filename: function (req, file, cb) {
            const extension = path.extname(file.originalname).toLowerCase();
            const name = crypto.createHash('md5').update(`${file.originalname}${Date.now()}`).digest('hex').toLowerCase();
            const fileName = `${name}${extension}`;
            cb(null, fileName);
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
        fileSize: 2 * 1000000
    }
});

export function photoUpload(req, res) {
    if (req.user.profile.photos.length >= 8) {
        return res.json(apiOutputTemplate("error", "profile.photos exceeds the limit of 8"));
    }

    upload.single('photo')(req, res, (err) => {
        // This err is multer specific one, which sucks.
        if (err) {
            let message = "";
            // This err code is multer itself implementation, which is funny
            if (err.code === "LIMIT_FILE_SIZE") {
                message = "File size > 2MB"
            } else {
                // This is the message I passed from the above cb
                message = err;
            }

            return res.json(apiOutputTemplate("error", message));
        }

        if (!req.file) {
            return res.json(apiOutputTemplate("error", "Photo field is required."));
        }

        const width = Number(req.body.width) || 320;
        const height = Number(req.body.height) || 240;

        const tmp = req.file.path.split(".");
        const outputPath = `${tmp[0]}_${width}_${height}.${tmp[1]}`;

        sharp.cache(false);
        sharp(req.file.path).resize(width, height).toFile(outputPath, (err, info) => {
            if (err) {
                return res.json(exports.apiOutputTemplate("error", err, {info: info}));
            }

            const photoURL = `${req.protocol}://${req.get('host')}/uploads/${path.parse(outputPath).base}`;
            const highresURL = `${req.protocol}://${req.get('host')}/uploads/${path.parse(req.file.path).base}`;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const photo = new Photo({
                photoURL: photoURL,
                highresURL: highresURL,
                baseUrl: baseUrl,
                type: "member"
            });

            photo.save((err, savedPhoto) => {
                if (err) return console.log(err);

                return savedPhoto;
            });
        });
    })
}