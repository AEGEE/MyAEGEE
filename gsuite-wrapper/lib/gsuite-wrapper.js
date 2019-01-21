const {runGsuiteOperation, gsuiteOperations} = require('./google-suite.js');

const log = require('./config/logger.js');

const redis = require('./redis.js').db;

//API DEFINITION

exports.createGroup = async function(req, res , next) { 
    log.debug(req.headers['test-title']);

    const data = req.body;

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;
    
    if( !data.groupName || !data.primaryEmail || !data.subjectID){

        response.message = "Validation error: primaryEmail, groupName, or subjectID is absent or empty";
        statusCode = 400;

    }else{

        try{
            let result = await runGsuiteOperation(gsuiteOperations.addGroup, data);
            response = {success: true, message: result.data.email+" group has been created", data: result.data };
            statusCode = result.code;

            redis.hset("group:"+data.subjectID, "GsuiteAccount", data.primaryEmail);
            redis.set("primary:"+data.subjectID, data.primaryEmail);
            redis.set("id:"+data.primaryEmail, data.subjectID);

        }catch(GsuiteError){
            //console.log(GsuiteError);
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            console.log(GsuiteError);
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

exports.deleteGroup = async function(req, res , next) { 
    log.debug(req.headers['test-title']);

    const subjectID = req.params.name;
    log.debug(subjectID); 

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;
    let groupID = ""; 

    if(subjectID){ 
        groupID = await redis.get("primary:"+subjectID);
        log.debug(groupID);
    } 
    if(!groupID){

        response.message = "Error: no group matching subjectID "+ subjectID;
        statusCode = 404;

    }else{

        const data = {primaryEmail: groupID};
        log.debug(data.primaryEmail);
    
        try{
            let result = await runGsuiteOperation(gsuiteOperations.deleteGroup, data);
            response = {success: result.success, message: data.primaryEmail+" group has been deleted", data: result.data };
            statusCode = result.code;
            log.debug(result); 
            if(result.success) {
              await redis.del("group:"+subjectID, "primary:"+subjectID, "id:"+groupID).catch(err => console.log("redis error: "+err));
            }

        }catch(GsuiteError){
            //log.debug(JSON.toString(GsuiteError));
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            console.log(GsuiteError);
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }
    }

    return res.status(statusCode).json(response);
};

exports.createAccount = async function(req, res , next) { 
    log.debug(req.headers['test-title']);

    const data = req.body; 

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;

    if( !data.subjectID || 
        !data.primaryEmail || 
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

            redis.hset("user:"+data.subjectID, "GsuiteAccount", data.primaryEmail, "SecondaryEmail", data.secondaryEmail );
            redis.set("primary:"+data.subjectID, data.primaryEmail);
            redis.set("primary:"+data.secondaryEmail, data.primaryEmail);
            redis.set("id:"+data.primaryEmail, data.subjectID);
            redis.set("secondary:"+data.primaryEmail, data.secondaryEmail);

        }catch(GsuiteError){
            //log.debug(JSON.toString(GsuiteError));
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            console.log(GsuiteError);
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

//Possible values for data.operation: add|remove|upgrade|downgrade
exports.editMembershipToGroup = async function(req, res , next) {
    log.debug(req.headers['test-title']);

    const personPK = req.params.username;    
    const data = req.body;

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;

    if( !data.groupPK ||
        !data.operation ||
        data.operation === "upgrade" || //NOT IMPLEMENTED YET
        data.operation === "downgrade" ||  //NOT IMPLEMENTED YET       
        (data.operation !== "add" && 
        data.operation !== "remove") ){

        response.message = "Validation error: operation empty or not valid; or primaryKey is absent or empty";
        statusCode = 400;

    }else{

        const userID = await redis.get("primary:"+personPK);
        const groupID = await redis.get("primary:"+data.groupPK);
        log.debug(userID);
        log.debug(groupID);
        data.primaryEmail = groupID;
        data.userName = userID;

        try{
            let operation = null;
            data.operation === "add" 
                    ? operation = gsuiteOperations.addUserInGroup
                    : data.operation === "remove" ? operation = gsuiteOperations.removeUserFromGroup
                    : operation = gsuiteOperations.changeUserGroupPrivilege ; ;

            let result = await runGsuiteOperation(operation, data);
            response = {success: result.success, message: result.data.email+" membership has been created", data: result.data };
            statusCode = result.code;

            if (data.operation === 'add' ){
                redis.sadd("membership:"+userID, groupID);
                redis.sadd("members:"+groupID, userID);
            }
            if (data.operation === 'remove' ){
                await redis.srem("membership:"+userID, groupID);
                await redis.srem("members:"+groupID, userID);
            }

        }catch(GsuiteError){
            //console.log(GsuiteError);
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            console.log(GsuiteError);
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

exports.createCalEvent = async function(req, res , next) { 
    log.debug(req.headers['test-title']);

    const data = req.body; 

    let response = {success: false, message: "Undefined error"};
    let statusCode = 500;
    
    if( !data.name || 
        !data.startDate || 
        !data.endDate || 
        !data.description || 
        !data.location || 
        !data.eventID){

        response.message = "Validation error: a required property is absent or empty";
        statusCode = 400;

    }else{

        const payload = {
            'id': data.eventID,
            'summary': data.name,
            'location': data.location,
            'description': data.description,
            'start': {
              //'dateTime': '2015-05-28T09:00:00-07:00',
              'dateTime': data.startDate,
              'timeZone': 'Europe/Brussels',
            },
            'end': {
              'dateTime': data.endDate,
              'timeZone': 'Europe/Brussels',
            },
            'reminders': {
              'useDefault': false,
              'overrides': [
                {'method': 'email', 'minutes': 24 * 60},
                {'method': 'popup', 'minutes': 10},
              ],
            },
          };

        try{
            let result = await runGsuiteOperation(gsuiteOperations.addEvent, payload);
            response = {success: true, message: result.data+"Event has been created", data: result.data };
            statusCode = result.code;
            console.log(result.data);
        }catch(GsuiteError){
            //log.debug(JSON.toString(GsuiteError));
            //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
            log.warn("GsuiteError");
            console.log(GsuiteError);
            response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
            statusCode = GsuiteError.code;
        }

    }

    return res.status(statusCode).json(response);
};

//HELPER or INTERNAL METHODS/VARS
