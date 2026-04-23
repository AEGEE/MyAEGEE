/**
 * Configuration Manager
 * Consolidates environment variables, local config files, and sensitive secrets 
 * into a single unified configuration object used throughout the microservice.
 */

// Sets the directory for the 'config' package to look for configuration files (e.g., default.json)
// __dirname ensures it looks in the current folder regardless of where the process started.
process.env.NODE_CONFIG_DIR = __dirname;

const config = require('config');

/**
 * Sensitive Data Integration
 * These lines inject private credentials into the main config object.
 * Note: These .json files are typically excluded from Git for security.
 */

// Load the Google Service Account key file for API authentication
config.GsuiteKeys = require('./myaegee-serviceaccount.json');

// Inject the delegated user email from secrets.json
// This is the account that the service account will "impersonate" to perform actions.
config.GsuiteKeys.delegatedUser = require('./secrets.json').delegatedUser;

// Inject the unique Customer ID required for G-Suite Directory API operations
config.customer_ID = require('./secrets.json').customer_ID;

// Export the hydrated configuration object for use in other modules
module.exports = config;
