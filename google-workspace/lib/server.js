/**
 * G-Suite Microservice Entry Point
 * This module handles the Express server lifecycle and routing for G-Suite account management.
 */

const express = require('express');
const router = require('express-promise-router'); // Middleware to handle async/await in routes without try-catch blocks
const bodyParser = require('body-parser');
const CsuiteRouter = router({ mergeParams: true }); // Allows access to params from parent routers if nested
const wrapper = require('./gsuite-wrapper'); // Logic layer for interacting with Google APIs
const config = require('./config/configFile');

/**
 * Route Definitions
 * Maps HTTP verbs and endpoints to specific functions in the wrapper.
 */
// POST: Creates a new G-Suite account
CsuiteRouter.post('/account', wrapper.createAccount);

// PUT: Suspends an existing account using the user Primary Key (userPK)
CsuiteRouter.put('/account/:userPK/suspend', wrapper.suspendAccount);

// PUT: Reactivates a suspended account using the user Primary Key (userPK)
CsuiteRouter.put('/account/:userPK/activate', wrapper.activateAccount);

/**
 * Server Configuration
 * Initialization of the Express application and middleware.
 */
const server = express();
server.use(bodyParser.json()); // Parses incoming JSON request bodies
server.use('/', CsuiteRouter); // Mounts the router at the root path

let app; // Placeholder for the running server instance

/**
 * Starts the HTTP server on the configured port.
 * @returns {Promise<void>} Resolves when the server is successfully listening.
 */
async function startServer() {
    return new Promise((res, rej) => {
        // Start listening for connections
        const localApp = server.listen(config.port, () => {
            app = localApp; // Store the instance for later closure
            console.log(`Up and running on port ${config.port}`);
            res();
        });

        // Error handling for port collisions or initialization failures
        localApp.on('error', (err) => rej(new Error('Error starting server: ' + err.stack)));
    });
}

/**
 * Gracefully shuts down the server.
 * Closes all active connections and clears the app instance.
 */
async function stopServer() {
    console.log('Stopping server...');
    if (app) {
        app.close();
        app = null;
    }
    console.log('Server stopped');
}

// Exporting functions and server objects for use in index.js or testing suites (like Mocha/Jest)
module.exports = {
    app,
    server,
    stopServer,
    startServer,
};