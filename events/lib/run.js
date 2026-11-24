/* istanbul ignore file -- process entry point: node starts it, the tests start the server themselves */
const { startServer } = require('./server');

(async () => {
    await startServer();
})();
