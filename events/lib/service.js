/* Stat thing... remove!*/
const stats = {
    requests: 0,
    started: Date.now(),
};

exports.status = (req, res) => {
    const ret = {
        requests: stats.requests,
        uptime: ((new Date()).getTime() - stats.started) / 1000,
    };

    return res.json({
        success: true,
        data: ret,
    });
};

// TODO remove, debug only
exports.getUser = (req, res) => {
    return res.json({
        success: true,
        data: req.user,
    });
};

exports.countRequests = (req, res, next) => {
    stats.requests++;
    return next();
};
