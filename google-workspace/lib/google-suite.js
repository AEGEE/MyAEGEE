// Copyright 2014-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const { google } = require('googleapis');
// const log = require('./util/logger');
const config = require('./config/configFile');

// JWT (JSON Web Token) is the authentication mechanism used by Google
// service accounts. It lets our server prove its identity to Google
// without a human user having to log in interactively.
const { JWT } = require('google-auth-library');

// ─── Authentication Setup ────────────────────────────────────────────────────
 
// Create a JWT authentication object using our service account credentials.
// This object will be reused for every API call we make to Google.
const jwt = new JWT({
    email: config.GsuiteKeys.client_email,
    key: config.GsuiteKeys.private_key,
    scopes: [
        'https://www.googleapis.com/auth/admin.directory.group',
        'https://www.googleapis.com/auth/admin.directory.group.member',
        'https://www.googleapis.com/auth/admin.directory.user',
        'https://www.googleapis.com/auth/calendar.events',
    ],
    subject: config.GsuiteKeys.delegatedUser,
});

// ─── Core Runner ─────────────────────────────────────────────────────────────
 
/**
 * runGsuiteOperation
 *
 * This is the central function that every GSuite API call goes through.
 * Think of it as a "wrapper" or "middleware" — it handles authentication
 * once, then delegates to whichever specific operation you want to run.
 *
 * Why is this useful? Because without it, every individual function
 * (addAccount, deleteAccount, etc.) would have to repeat the same
 * authentication logic. This way we keep the code DRY. 
 */
async function runGsuiteOperation(operation, payload) {
    // Step 1: Authenticate with Google using our JWT credentials.
    // jwt.authorize() exchanges our private key for an access token
    // that Google will accept for the scopes we declared above.
    try {
        const authRes = await jwt.authorize();
        // console.log('Auth successful: \n' + JSON.stringify(authRes));
        console.log('Auth successful');
    } catch (AuthError) {
        console.log('Authentication error to GSuite!' + AuthError.toString());
        throw { errors: [{ message: 'Authentication error to GSuite' }], code: 500};
    }

    // Step 2: Run the actual operation now that we are authenticated.
    // We pass the jwt object so the operation can attach it to its API call.
    const res = await operation(jwt, payload);
    const operationResult = { success: true, code: res.status, data: res.data };

    // --------- GOOD PRACTICES FOR MYAEGEE?? ---------
    // code for 'created' is 201 but Google returns 200
    if (operation.name.indexOf('add') > -1 && operationResult.code === 200 ){
        operationResult.code = 201;
    }

    // by standard, 204 has no content body, but we always return content
    if (operationResult.code === 204) { operationResult.code = 200; }

    // -------------

    // Step 3: Build a standardised result object so all callers get
    // a consistent response shape regardless of which operation ran.
    return operationResult;
}

// ─── GSuite Operations ────────────────────────────────────────────────────────
 
// gsuiteOperations is a plain object whose properties are async functions.
// Each function performs exactly one Admin SDK action.
//
// Design note: none of these functions handle authentication themselves —
// they all receive an already-authorised `jwt` object from runGsuiteOperation.
// This keeps each function focused on a single responsibility.
const gsuiteOperations = {

    // CRUD for accounts
    addAccount: async function addAccount(jwt, data) {
        const admin = google.admin('directory_v1');
        const result = await admin.users.insert({
            auth: jwt,
            requestBody: data,
        });
        console.log('[MyAEGEE] gsuiteOperations.addAccount working...')

        return result;
    },

    getAccount: async function getAccount(jwt, data) {
        const admin = google.admin('directory_v1');
        const result = await admin.users.get({
            auth: jwt,
            userKey: data.primaryEmail,
        });
        console.log('[MyAEGEE] gsuiteOperations.getAccount working...')
        
        return result;
    },

    // This is not needed. Use suspend instead.
    deleteAccount: async function deleteAccount(jwt, data) {
        const admin = google.admin('directory_v1');
        const result = await admin.users.delete({
            auth: jwt,
            userKey: data.primaryEmail,
        });
        console.log('[MyAEGEE] gsuiteOperations.deleteAccount working...')

        return result;
    },


    /**
     * editAccount
     * Generic account update — intentionally left unimplemented.
     *
     * A generic "edit everything" function is risky because it could
     * accidentally overwrite fields you did not intend to change.
     * Instead, use the focused helpers below (suspendAccount, activateAccount)
     * or add new purpose-built functions for each specific update you need.
     */
    editAccount: async function editAccount(jwt, data) {
        throw GsuiteError;
    },

    /**
     * suspendAccount
     * Suspends (disables) a Google Workspace user account.
     *
     * A suspended user cannot sign in, but their data and account are preserved.
     * This is the recommended alternative to deleteAccount() when you want
     * to revoke access without losing the user's data.
     */
    suspendAccount: async function suspendAccount(jwt, data) {
        const admin = google.admin('directory_v1');
        const result = await admin.users.update({
            auth: jwt,
            userKey: data.primaryEmail,
            requestBody: { suspended: true },
        });
        console.log('[MyAEGEE] gsuiteOperations.suspendAccount working...')

        return result;
    },

    /**
     * activateAccount
     * Re-activates a previously suspended Google Workspace user account.
     *
     * This is the exact mirror of suspendAccount() — it flips the
     * suspended flag back to false so the user can sign in again.
     */
    activateAccount: async function activateAccount(jwt, data) {
        const admin = google.admin('directory_v1');
        const result = await admin.users.update({
            auth: jwt,
            userKey: data.primaryEmail,
            requestBody: { suspended: false },
        });
        console.log('[MyAEGEE] gsuiteOperations.activateAccount working...')

        return result;
    },
}


exports.runGsuiteOperation = runGsuiteOperation;
exports.gsuiteOperations = gsuiteOperations;