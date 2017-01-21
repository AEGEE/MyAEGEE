const httprequest = require('request');
const config = require('./config/config.js');

exports.checkApplicationValidity = (application, applicationFields) => {
  // Check if every field in the application array resembles to a field in event.applicationFields
  if (application === undefined || Object.prototype.toString.call(application) !== '[object Array]') {
    return { passed: false, msg: 'Not an array' };
  }
  if (application.length > applicationFields.length) {
    return { passed: false, msg: 'Application too long' };
  }

  // O(N*N), let's hope applications don't get big
  let error = false;
  application.forEach((userField) => {
    if (applicationFields
        .find(applicationField => applicationField._id === userField.field_id) === undefined) {
      error = true;
    }
  });

  if (error) {
    return { passed: false, msg: 'Invalid field_id' };
  }

  // TODO Check for duplicate fields

  return { passed: true, msg: '' };
};

exports.getUserById = (authToken, id, callback) => {
  require('./config/options.js').then((options) => {
    const opts = {
      url: `${config.core.url}:${config.core.port}/api/getUser`,
      method: 'GET',
      headers: options.getRequestHeaders(authToken),
      qs: {
        id,
      },
    };

    httprequest(opts, (requestError, requestResult, requestBody) => {
      if (requestError) {
        // log.error("Could not contact core", err);
        return callback(requestError, null);
      }

      let body;
      try {
        body = JSON.parse(requestBody);
      } catch (err) {
        // log.error("Could not parse core response", err);
        return callback(err, null);
      }

      if (!body.success) {
        // log.info("Access denied to user", body);
        return callback(null, null);
      }

      body.user.antenna_name = body.user.antenna.name;
      return callback(null, { basic: body.user });
    });
  });
};
