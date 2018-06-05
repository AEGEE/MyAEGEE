/* istanbul ignore next */
const { startServer } = require('./server');

// The separation of this file and lib/server.js was done on purpose.
// The lib/server.js is used in API tests, the 'supertest' lib
// is running causing the EADDRINUSE error, so that's why the listening
// was moved here.
// More: http://www.marcusoft.net/2015/10/eaddrinuse-when-watching-tests-with-mocha-and-supertest.html

/* istanbul ignore next */
(async () => {
    await startServer();
})();
