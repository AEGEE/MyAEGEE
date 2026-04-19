const { runGsuiteOperation, gsuiteOperations } = require('./google-suite');
const config = require('./config/configFile');

// ─── Controller Functions ─────────────────────────────────────────────────────
//
// Each function below is an Express route handler, meaning Express will call
// it automatically when a matching HTTP request arrives.
//
// All three handlers share the same signature:
//   req  — the incoming HTTP request (headers, body, params, etc.)
//   res  — the outgoing HTTP response object (we use res.status().json() to reply)
//   next — a callback to pass control to the next middleware (not used here,
//           but required by Express's convention for async error handling)
//
// All three also follow the same structure:
//   1. Read the request body into `data`
//   2. Set safe default values for `response` and `statusCode`
//   3. Optionally validate the input
//   4. Call runGsuiteOperation() inside a try/catch
//   5. On success — build a success response
//   6. On failure — build an error response from the caught GsuiteError
//   7. Return the JSON response with the appropriate HTTP status code

exports.createAccount = async function (req, res, next) {
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    if( !data.userPK
        || !data.primaryEmail
        || !data.recoveryEmail
        || !data.password
        || !data.organizations[0].department
        || !data.name.givenName
        || !data.name.familyName) {
        response.message = 'Validation error: a required property is absent or empty';
        statusCode = 400;
    }

    try {
        const result = await runGsuiteOperation(gsuiteOperations.addAccount, data);
        response = { 
            success: result.success,
            message: result.data.primaryEmail + ' account has been created',
            data: result.data 
        };
        statusCode = result.code;

        // Redis code TODO
    } catch (GsuiteError) {
        // console.log('GsuiteError:', GsuiteError);
        response = { success: false, errors: GsuiteError.errors, message: GsuiteError };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
};

exports.suspendAccount = async function (req, res, next) {
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    // Checks TODO on the req body. 
    // if (...) {...}
    
    try {
        const result = await runGsuiteOperation(gsuiteOperations.suspendAccount, data);
        response = { 
            success: result.success,
            message: result.data.primaryEmail + ' account has been suspended',
            data: result.data 
        };
        statusCode = result.code;

        // Redis code TODO
    } catch (GsuiteError) {
        // console.log('GsuiteError:', GsuiteError);
        response = { success: false, errors: GsuiteError.errors, message: GsuiteError };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
}

exports.activateAccount = async function (req, res, next) {
    const data = req.body;

    let response = { success: false, message: 'Undefined error' };
    let statusCode = 500;

    // Checks TODO on the req body. 
    // if (...) {...}
    
    try {
        const result = await runGsuiteOperation(gsuiteOperations.activateAccount, data);
        response = { 
            success: result.success,
            message: result.data.primaryEmail + ' account has been activated',
            data: result.data 
        };
        statusCode = result.code;

        // Redis code TODO
    } catch (GsuiteError) {
        // console.log('GsuiteError:', GsuiteError);
        response = { success: false, errors: GsuiteError.errors, message: GsuiteError };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
}