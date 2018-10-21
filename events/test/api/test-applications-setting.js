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

describe('Events application create/update', () => {
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

  it('should disallow application for event you cannot see', (done) => {
    const notVisibleButOpenedEvent = events.find(e => e.status.name === 'Draft' && e.application_status === 'open');

    chai.request(server)
      .put(`/single/${notVisibleButOpenedEvent.id}/participants/mine`)
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

  it('should disallow application for events with closed deadline', (done) => {
    const openedEvent = events.find(e => e.status.name === 'Requesting' && e.application_status === 'closed');

    chai.request(server)
      .put(`/single/${openedEvent.id}/participants/mine`)
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

  it('should disallow application for events for organizers', (done) => {
    const organizingEvent = events.find(e => e.organizers.map(o => o.user_id).includes(user.id));

    chai.request(server)
      .put(`/single/${organizingEvent.id}/participants/mine`)
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

  it('should not update the application if the status is not "requesting"', (done) => {
    const appliedEvent = events.find(e => e.applications.map(app => app.user_id).includes(user.id));
    const application = appliedEvent.applications.find(app => app.user_id === user.id);
    application.status = 'accepted';

    appliedEvent.save().then(() => {
      const newApplication = application.application;
      newApplication[0].value = 'Another motivation';

      chai.request(server)
        .put(`/single/${appliedEvent.id}/participants/mine`)
        .set('X-Auth-Token', 'foobar')
        .send({
          application: newApplication,
        })
        .end((err, res) => {
          expect(res).to.have.status(403);
          expect(res).to.be.json;
          expect(res).to.be.a('object');

          expect(res.body.success).to.be.false;
          expect(res.body).to.have.property('message');

          done();
        });
    });

  });

  it('should update application if it already exists', (done) => {
    const appliedEvent = events.find(e => e.applications.map(app => app.user_id).includes(user.id));
    const application = JSON.parse(JSON.stringify(appliedEvent.applications.find(app => app.user_id === user.id).application));
    application[0].value = 'Another motivation';

    chai.request(server)
      .put(`/single/${appliedEvent.id}/participants/mine`)
      .set('X-Auth-Token', 'foobar')
      .send({ application })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(appliedEvent.id).then(event => {
          const newApplication = event.applications.find(app => app.user_id === user.id).application;
          const oldApplication = appliedEvent.applications.find(app => app.user_id === user.id).application;

          expect(newApplication[0].value).not.to.equal(oldApplication[0].value);
          expect(newApplication[1].value).to.equal(oldApplication[1].value);

          done();
        });
      });
  });

  it('should not add the application if the person is not a member of a body', (done) => {
    const notAppliedEvent = events.find(e => !e.applications.map(app => app.user_id).includes(user.id) && e.status.name === 'Approved');

    const application = notAppliedEvent.application_fields.map(field => ({
      field_id: field.id,
      value: 'Bla bla bla'
    }));

    chai.request(server)
      .put(`/single/${notAppliedEvent.id}/participants/mine`)
      .set('X-Auth-Token', 'foobar')
      .send({
        application,
        body_id: 111
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should add the application if it doesn\'t exists', (done) => {
    const notAppliedEvent = events.find(e => !e.applications.map(app => app.user_id).includes(user.id) && e.status.name === 'Approved');

    const application = notAppliedEvent.application_fields.map(field => ({
      field_id: field.id,
      value: 'Bla bla bla'
    }));

    chai.request(server)
      .put(`/single/${notAppliedEvent.id}/participants/mine`)
      .set('X-Auth-Token', 'foobar')
      .send({
        application,
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(notAppliedEvent.id).then(event => {
          const newApplication = event.applications.find(app => app.user_id === user.id);
          const oldApplication = notAppliedEvent.applications.find(app => app.user_id === user.id);

          expect(oldApplication).to.not.exist;
          expect(newApplication).to.exist;

          done();
        });
      });
  });
});
