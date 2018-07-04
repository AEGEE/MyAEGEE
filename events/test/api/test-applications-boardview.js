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

describe('Events application boardview', () => {
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

  it('should return an error if you are not a boardmember of this body', (done) => {
    chai.request(server)
      .get('/boardview/1337')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should return an error if bodyId is not a number', (done) => {
    chai.request(server)
      .get('/boardview/nan')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should display the application of the current body', (done) => {
    const boardBodies = admin.bodies
      .filter(b => admin.circles.some(c => c.body_id === b.id && c.name.toLowerCase().includes('board')))
      .map(b => b.id);
    const boardEvent = events.find(e => e.applications.some(a => boardBodies.includes(a.body_id)));
    const application = boardEvent.applications.find(a => boardBodies.includes(a.body_id))


    chai.request(server)
      .get(`/boardview/${boardBodies[0]}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        expect(res.body.data.map(d => d.user_id)).to.include(application.user_id);
        expect(res.body.data.map(d => d.board_comment)).to.include(application.board_comment);
        expect(res.body.data.map(d => d.body_id)).to.include(application.body_id);

        done();
      });
  });

  it('should not display the application of other bodies', (done) => {
    const boardBodies = admin.bodies
      .filter(b => admin.circles.some(c => c.body_id === b.id && c.name.toLowerCase().includes('board')))
      .map(b => b.id);
    const boardEvent = events.find(e => e.applications.length > 0 && e.applications.every(a => !boardBodies.includes(a.body_id)));
    const application = boardEvent.applications[0];

    chai.request(server)
      .get(`/boardview/${boardBodies[0]}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        expect(res.body.data.map(d => d.user_id)).not.to.include(application.user_id);
        expect(res.body.data.map(d => d.body_id)).not.to.include(application.body_id);

        done();
      });
  });
});
