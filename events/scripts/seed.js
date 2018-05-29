const request = require('request-promise-native');
const communication = require('../lib/communication');

exports.makeAccessObject = access => {
  const result = { users: [], bodies: [], circles: [], special: [] };
  if (access.users) result.users = [...result.users, ...access.users];
  if (access.bodies) result.bodies = [...result.bodies, ...access.bodies];
  if (access.circles) result.circles = [...result.circles, ...access.circles];
  if (access.special) result.special = [...result.special, ...access.special];

  return result;
};

exports.publicSchema = exports.makeAccessObject({ special: ['Public'] });
exports.organizerSchema = exports.makeAccessObject({ special: ['Organizer'] });
exports.emptySchema = exports.makeAccessObject({});

exports.queryAPI = async (url, headers) => {
  const service = await communication.getServiceByName('oms-core-elixir');
  const result = await request({
    url: service.backend_url + url,
    method: 'GET',
    headers,
    simple: false,
    form: {
      token: headers['X-Auth-Token'],
    },
    json: true,
  });

  if (!result.success) {
    throw new Error('Got unsuccessful response from ' + url)
  }

  return result.data;
};

exports.generateLifecycles = async (options) => {
  const { bodies, circle } = options;

  const eqacBody = bodies.find(body => body.name === 'Events Quality Assurance Committee');
  const netcomBody = bodies.find(body => body.name === 'Network Commission');

  const draftStatus = {
    name: 'Draft',
    visibility: exports.organizerSchema,
    applicable: exports.emptySchema,
    edit_details: exports.organizerSchema,
    edit_organizers: exports.organizerSchema,
    edit_details: exports.organizerSchema,
    edit_application_status: exports.emptySchema,
    approve_participants: exports.emptySchema,
    view_applications: exports.emptySchema,
  };

  const requestingStatus = {
    name: 'Requesting',
    visibility: exports.organizerSchema,
    applicable: exports.emptySchema,
    edit_details: exports.organizerSchema,
    edit_organizers: exports.organizerSchema,
    edit_details: exports.organizerSchema,
    edit_application_status: exports.emptySchema,
    approve_participants: exports.emptySchema,
    view_applications: exports.emptySchema,
  };

  const publishedStatus = {
    name: 'Published',
    visibility: exports.publicSchema,
    applicable: exports.publicSchema,
    edit_details: exports.emptySchema,
    edit_organizers: exports.emptySchema,
    edit_details: exports.emptySchema,
    edit_application_status: exports.organizerSchema,
    approve_participants: exports.organizerSchema,
    view_applications: exports.organizerSchema,
  };

  const transitions = [
    { from: null, to: 'Draft', allowedFor: exports.publicSchema },
    { from: 'Draft', to: 'Requesting', allowedFor: exports.organizerSchema },
    { from: 'Requesting', to: 'Published', allowedFor: exports.makeAccessObject({ bodies: [eqacBody.id] }) },
    { from: 'Requesting', to: 'Draft', allowedFor: exports.makeAccessObject({ bodies: [eqacBody.id] }) },
  ];

  const names = ['nwm', 'rtc', 'ltc', 'wu', 'es', 'local'];

  const eqacEventTypes = ['rtc', 'wu', 'es', 'local'].map(name => ({
    name,
    defaultLifecycle: {
      eventType: name,
      transitions,
      initialStatus: 'Draft',
      statuses: [draftStatus, requestingStatus, publishedStatus]
    }
  }));

  const netcomEventTypes = ['nwm', 'ltc'].map(name => ({
    name,
    defaultLifecycle: {
      eventType: name,
      transitions,
      initialStatus: 'Draft',
      statuses: [draftStatus, requestingStatus, publishedStatus]
    }
  }));

  return [...eqacEventTypes, ...netcomEventTypes];
}
