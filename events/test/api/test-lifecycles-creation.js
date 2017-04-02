const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');

const should = chai.should();
chai.use(chaiHttp);

let accessObject = {
  users: [],
  roles: [],
  bodies: [],
  special: [],
};

describe('Lifecycles creation', () => {
  let statuses;
  let lifecycles;
  let eventTypes;

  let newLifecycle;

  beforeEach((done) => {
    newLifecycle = {
      eventType: 'non-statutory',
      status: [{
        name: 'Status 1',
        visibility: accessObject,
        applicable: accessObject,
      }, {
        name: 'Status 2',
        visibility: accessObject,
        applicable: accessObject,
      }, {
        name: 'Status 3',
        visibility: accessObject,
        applicable: accessObject,
      }],
      transitions: [{
        from: null,
        to: 'Status 1',
        allowedFor: accessObject,
      }, {
        from: 'Status 1',
        to: 'Status 2',
        allowedFor: accessObject,
      }, {
        from: 'Status 2',
        to: 'Status 1',
        allowedFor: accessObject,
      }, {
        from: 'Status 2',
        to: 'Status 3',
        allowedFor: accessObject,
      }],
      initialStatus: 'Status 1',
    };

    db.clear();
    db.populateLifecycles((res) => {
      statuses = res.statuses;
      lifecycles = res.lifecycles;
      eventTypes = res.eventTypes;

      done();
    });
  });

  it('should not create/update lifecycle if no eventType is specified', (done) => {
    delete newLifecycle.eventType;
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if no \'status\' field is presented', (done) => {
    delete newLifecycle.status;
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if \`statuses\' field is empty', (done) => {
    newLifecycle.status = [];
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if no initialStatus is specified', (done) => {
    delete newLifecycle.initialStatus;
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if no \'transitions\' field is specified', (done) => {
    delete newLifecycle.transitions;
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if \'transitions\' field is empty', (done) => {
    newLifecycle.transitions = [];
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if there are statuses with the same name', (done) => {
    newLifecycle.status.push({
      name: 'Status 1',
      visibility: accessObject,
      applicable: accessObject,
    });
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if initialStatus is not defined in statuses', (done) => {
    newLifecycle.initialStatus = 'Status 4';
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if transition\'s \'from\' status is not defined in statuses', (done) => {
    newLifecycle.transitions[0].from = 'Status 4';
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if transition\'s \'to\' status is not defined in statuses', (done) => {
    newLifecycle.transitions[0].to = 'Status 4';
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should not create/update lifecycle if null -> default transition is not specified', (done) => {
    // remove 1st transition
    newLifecycle.transitions.splice(0, 1);
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should create/update lifecycle if all fields are filled in right', (done) => {
    chai.request(server)
      .post('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(201);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;

        done();
      });
  });
});
