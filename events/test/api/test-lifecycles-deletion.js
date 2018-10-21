const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');

const should = chai.should();
chai.use(chaiHttp);

let accessObject = {
  users: [],
  roles: [],
  bodies: [],
  special: [],
};

describe('Lifecycles deletion', () => {
  let statuses;
  let lifecycles;
  let eventTypes;

  let newLifecycle;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    newLifecycle = {
      eventType: 'non-statutory',
      statuses: [{
        name: 'Status 1',
        visibility: accessObject,
        applicable: accessObject,
        edit_organizers: accessObject,
        edit_details: accessObject
      }, {
        name: 'Status 2',
        visibility: accessObject,
        applicable: accessObject,
        edit_organizers: accessObject,
        edit_details: accessObject
      }, {
        name: 'Status 3',
        visibility: accessObject,
        applicable: accessObject,
        edit_organizers: accessObject,
        edit_details: accessObject
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

    await db.clear();
    const res = await db.populateLifecycles();
    lifecycles = res.lifecycles;
    eventTypes = res.eventTypes;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should fail if no event type exists', (done) => {
    chai.request(server)
      .delete('/lifecycle/non-existant')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(404);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should fail on unautorized access', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .delete('/lifecycle/statutory')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(403);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;

        done();
      });
  });

  it('should success on correct request', (done) => {
    chai.request(server)
      .delete('/lifecycle/statutory')
      .set('X-Auth-Token', 'foobar')
      .send(newLifecycle)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;

        done();
      });
  });
});
