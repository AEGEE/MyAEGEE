const {runGsuiteOperation, gsuiteOperations} = require('./google-suite.js');

var log = require('./config/logger');

//redis config
//var config = require('./config/config.json');

//API DEFINITION

exports.createGroup = async function(req, res , next) { 
    //req.log.debug({req: req}, 'findAllUsers request');
    const data = req.body;

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;
    
    if( !data.groupName || !data.primaryEmail ){

        response.message = "Validation error: primaryEmail or groupName is absent or empty";
        statusCode = 400;

    }else{

        try{
            let result = await runGsuiteOperation(gsuiteOperations.addGroup, data);
            response = {success: true, message: result.data.email+" group has been created", data: result.data };
            statusCode = result.code;
        }catch(GsuiteError){
            //console.log(GsuiteError);
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

exports.deleteGroup = async function(req, res , next) { 
    //req.log.debug({req: req}, 'findAllUsers request');
    const data = {groupName: req.params.name};

    let response = {success: false, message: "Undefined error"};
    let statusCode = '500';
    
    try{
        let result = await runGsuiteOperation(gsuiteOperations.deleteGroup, data);
        response = {success: true, message: data.groupName+" group has been deleted", data: result.data };
        statusCode = result.code;
    }catch(GsuiteError){
        //log.debug(JSON.toString(GsuiteError));
        //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
        log.warn("GsuiteError");
        response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
};

exports.createAccount = async function(req, res , next) { 
    //req.log.debug({req: req}, 'findAllUsers request');
    const data = req.body; 

    let response = {success: false, message: "Undefined error"};
    let statusCode = '500';
    
    if( !data.primaryEmail || 
        !data.secondaryEmail || 
        !data.password || 
        !data.antenna || 
        !data.name.givenName ||
        !data.name.familyName ){

        response.message = "Validation error: a required property is absent or empty";
        statusCode = 400;

    }else{

        const payload = {
            "primaryEmail": data.primaryEmail,
            "name": data.name,
            "password": data.password,
            "hashFunction": "SHA-1",
            "emails": [
            {
              "address": data.secondaryEmail,
              "type": "home",
              "customType": "",
              "primary": true
            }
            ],
            "organizations": [
            {
                "department": data.antenna
            }
            ],
            "orgUnitPath": "/individuals",
            "includeInGlobalAddressList": true
          }

        try{
            let result = await runGsuiteOperation(gsuiteOperations.addAccount, payload);
            response = {success: true, message: result.data.primaryEmail+" account has been created", data: result.data };
            statusCode = result.code;
        }catch(GsuiteError){
            //log.debug(JSON.toString(GsuiteError));
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

//HELPER or INTERNAL METHODS/VARS
