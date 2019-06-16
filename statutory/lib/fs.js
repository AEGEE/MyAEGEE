const fs = require('fs');
const rimraf = require('rimraf');

const rimrafPromisified = (file) => new Promise((resolve, reject) => {
    rimraf(file, err => {
        if (err) {
            return reject(err);
        }

        return resolve();
    });
});

module.exports = {
    createReadStream: fs.createReadStream,
    mkdir: fs.promises.mkdir,
    remove: fs.promises.unlink,
    existsSync: fs.existsSync,
    rimraf: rimrafPromisified
};
