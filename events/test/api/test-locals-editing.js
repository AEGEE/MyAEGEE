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

describe('Events organizing locals management', () => {
  let events;

  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    await db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;

    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should disallow adding a body for event you cannot edit', (done) => {
    const notEditableEvent = events.find(e => e.organizers.every(org => org.user_id !== user.id));

    chai.request(server)
      .post(`/single/${notEditableEvent.id}/locals/`)
      .set('X-Auth-Token', 'foobar')
      .send({ body_id: 333 })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should disallow adding organizing body if the user is already an organizer', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    const organizingBody = editableEvent.organizing_locals[0].body_id;

    chai.request(server)
      .post(`/single/${editableEvent.id}/locals/`)
      .set('X-Auth-Token', 'foobar')
      .send({ body_id: organizingBody })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should allow adding organizing body for event you can edit', (done) => {
    const editableEvent = events.find(e => e.organizers.some(org => org.user_id === user.id));

    chai.request(server)
      .post(`/single/${editableEvent.id}/locals/`)
      .set('X-Auth-Token', 'foobar')
      .send({ body_id: 333 })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(editableEvent.id).then((newEvent) => {
          expect(newEvent.organizing_locals.map(org => org.body_id)).to.contain(333);

          done();
        }).catch(console.log);
      });
  });

  it('should disallow deleting organizing body for event you cannot edit', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.every(org => org.user_id !== user.id) && e.organizers.some(org => org.user_id === admin.id));
    const body = notEditableEvent.organizing_locals[0].id;

    chai.request(server)
      .del(`/single/${notEditableEvent.id}/locals/${body}`)
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

  it('should disallow deleting organizing body if bodyId is not a number', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .del(`/single/${editableEvent.id}/locals/lalala`)
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

  it('should disallow deleting organizing body if local is not an organizing local', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.every(org => org.user_id !== admin.id));

    chai.request(server)
      .del(`/single/${notEditableEvent.id}/locals/90210`)
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

  it('should disallow deleting organizing body if body is only organizing body', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.length === 1 && e.organizers[0].user_id === user.id && e.organizing_locals.length === 1);
    const body = editableEvent.organizing_locals[0].body_id;

    chai.request(server)
      .del(`/single/${editableEvent.id}/locals/${body}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should allow deleting organizer for event you can edit', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id) && e.organizing_locals.length > 1);
    const body = editableEvent.organizing_locals[0].body_id;

    chai.request(server)
      .del(`/single/${editableEvent.id}/locals/${body}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(editableEvent.id).then((newEvent) => {
          expect(newEvent.organizing_locals.map(org => org.body_id)).not.to.contain(body);

          done();
        })
      });
  });
});
