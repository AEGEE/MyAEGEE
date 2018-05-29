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

describe('Events application info', () => {
  let events;

  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    await db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;
    eventTypes = res.eventTypes;

    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should return an error if application is not found', (done) => {
    const notAppliedEvent = events.find(e => !e.applications.map(app => app.user_id).includes(user.id));

    chai.request(server)
      .get(`/single/${notAppliedEvent.id}/participants/mine`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should display the application if it exists', (done) => {
    const appliedEvent = events.find(e => e.applications.map(app => app.user_id).includes(user.id));

    chai.request(server)
      .get(`/single/${appliedEvent.id}/participants/mine`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        done();
      });
  });
});
