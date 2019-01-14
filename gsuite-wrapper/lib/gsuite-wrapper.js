//PREAMBLE STUFF
const {runGsuiteOperation, gsuiteOperations} = require('./google-suite.js');

var log = require('./config/logger');

//redis config
//var config = require('./config/config.json');



//API DEFINITION

exports.createGroup = async function(req, res , next) { 
    //req.log.debug({req: req}, 'findAllUsers request');
    const data = req.body;

    let result = "Undefined error";
    let response = {success: false, message: result};
    let statusCode = '500';
    
    try{
        result = await runGsuiteOperation(gsuiteOperations.addGroup, data);
        response = {success: true, message: result.data.email+" group has been created", data: result.data };
        statusCode = result.code;
    }catch(GsuiteError){
        //console.log(GsuiteError);
        //response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message, code: GsuiteError.response.status};
        log.warn("GsuiteError");
        response = {success: false, errors: GsuiteError.errors, message: GsuiteError.errors[0].message };
        statusCode = GsuiteError.code;
    }

    return res.status(statusCode).json(response);
};

exports.deleteGroup = async function(req, res , next) { 
    //req.log.debug({req: req}, 'findAllUsers request');
    const data = {groupName: req.params.name};

    let result = "Undefined error";
    let response = {success: false, message: result};
    let statusCode = '500';
    
    try{
        result = await runGsuiteOperation(gsuiteOperations.deleteGroup, data);
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

    let result = "Undefined error";
    let response = {success: false, message: result};
    let statusCode = '500';
    
    try{
        result = await runGsuiteOperation(gsuiteOperations.addAccount, data);
        response = {success: true, message: result.data.primaryEmail+" account has been created", data: result.data };
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

//HELPER or INTERNAL METHODS/VARS
