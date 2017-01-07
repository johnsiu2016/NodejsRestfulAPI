exports.apiOutputTemplate = (type, message, data) => {
    return {
        status: {
            type: type,
            message: message
        },
        ...data
    }
};
