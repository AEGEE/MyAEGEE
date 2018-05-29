const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const Event = require('../../lib/models/Event');
const helpers = require('../../lib/helpers');

const admin = require('../assets/oms-core-valid').data;
const user = require('../assets/oms-core-valid-not-superadmin').data;
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events application listing', () => {
  let events;

  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    await db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;
    eventTypes = res.eventTypes;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should display only accepted pax if you cannot view applications', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get(`/single/${events[0].id}/participants`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        const acceptedPaxIds = events[0].applications.filter(app => app.status === 'accepted').map(app => app.user_id);
        const resultPaxIds = res.body.data.map(app => app.user_id);

        expect(res.body.data.length).to.equal(acceptedPaxIds.length);
        for (const pax of acceptedPaxIds) {
          expect(resultPaxIds).to.include(pax);
        }

        done();
      });
  });

  it('should display not-accepted pax if you can see them', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}/participants`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        const eventPaxIds = events[0].applications.map(app => app.user_id);
        const resultPaxIds = res.body.data.map(app => app.user_id);

        expect(res.body.data.length).to.equal(eventPaxIds.length);
        for (const pax of eventPaxIds) {
          expect(resultPaxIds).to.include(pax);
        }

        done();
      });
  });

  it('should not display board comment and motivation if you cannot approve participants', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get(`/single/${events[0].id}/participants`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        for (const pax of res.body.data) {
          expect(pax).to.not.have.property('application');
          expect(pax).to.not.have.property('board_comment');
        }

        done();
      });
  });

  it('should display board comment and motivation if you can approve participants', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}/participants`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        for (const pax of res.body.data) {
          expect(pax).to.have.property('application');
          expect(pax).to.have.property('board_comment');
        }

        done();
      });
  });

  it('should not display events I haven\'t applied at /mine/participating', (done) => {
    const notMineEvents = events.filter(e => e.applications.every(a => a.user_id !== admin.id)).map(e => e.id);

    chai.request(server)
      .get(`/mine/participating`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        for (const event of res.body.data) {
          expect(notMineEvents).not.to.include(event.id)
        }

        done();
      });
  });

  it('should display events I\'ve applied at /mine/participating', (done) => {
    const myEvents = events.filter(e => e.applications.some(a => a.user_id === admin.id)).map(e => e.id);

    chai.request(server)
      .get(`/mine/participating`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        for (const event of res.body.data) {
          expect(myEvents).to.include(event.id)
        }

        done();
      });
  });
});
