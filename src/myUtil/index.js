exports.apiOutputTemplate = (type, message, data) => {
    return {
        status: {
            type: type,
            message: message
        },
        ...data
    }
};

const fs = require("fs");

exports.createDirIfNotExists = (path, mask, cb) => {
    if (typeof mask == 'function') { // allow the `mask` parameter to be optional
        cb = mask;
        mask = 0o777;
    }
    fs.mkdir(path, mask, function(err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
            else cb(err); // something else went wrong
        } else cb(null); // successfully created folder
    });
};