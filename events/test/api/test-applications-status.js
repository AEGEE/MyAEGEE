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

describe('Events application status', () => {
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

  it('should disallow changing status if you don\'t have rights for it', (done) => {
    const event = events.find(e => e.status.name === 'Draft' && e.application_status === 'closed' && e.applications.length > 0);
    const application = event.applications.find(e => e.status === 'requesting');

    chai.request(server)
      .put(`/single/${event.id}/participants/${application.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'approved' })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should disallow changing status if the applications are opened', (done) => {
    const event = events.find(e => e.status.name === 'Approved' && e.application_status === 'open' && e.applications.length > 0);
    const application = event.applications.find(e => e.status === 'requesting');

    chai.request(server)
      .put(`/single/${event.id}/participants/${application.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'accepted' })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should disallow changing status if the status is nonexistant', (done) => {
    const event = events.find(e =>
      e.status.name === 'Approved'
      && e.application_status === 'closed'
      && e.organizers.map(o => o.user_id).includes(user.id)
      && e.applications.length > 0);
    const application = event.applications.find(e => e.status === 'requesting');

    chai.request(server)
      .put(`/single/${event.id}/participants/${application.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'not-accepted' })
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');
        expect(res.body).to.have.property('errors');

        done();
      });
  });

  it('should disallow changing status if applications is not found', (done) => {
    const event = events.find(e =>
      e.status.name === 'Approved'
      && e.application_status === 'closed'
      && e.organizers.map(o => o.user_id).includes(user.id)
      && e.applications.length > 0);

    chai.request(server)
      .put(`/single/${event.id}/participants/nonexistant/status`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'accepted' })
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should allow changing status if everything is okay', (done) => {
    const event = events.find(e =>
      e.status.name === 'Approved'
      && e.application_status === 'closed'
      && e.organizers.map(o => o.user_id).includes(user.id)
      && e.applications.length > 0);
    const application = event.applications.find(e => e.status === 'requesting');

    chai.request(server)
      .put(`/single/${event.id}/participants/${application.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'accepted' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(event.id).then((newEvent) => {
          const newApplication = newEvent.applications.find(e => e.user_id === user.id);
          expect(newApplication.status).to.equal('accepted');

          done();
        });
      });
  });
});
