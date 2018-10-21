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

describe('Events organization management', () => {
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

  it('should disallow adding organizer for event you cannot edit', (done) => {
    const notEditableEvent = events.find(e => e.organizers.every(org => org.user_id !== user.id));

    chai.request(server)
      .post(`/single/${notEditableEvent.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Good guy'
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

  it('should disallow adding organizer if the user is already an organizer', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .post(`/single/${notEditableEvent.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Not that good guy'
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

  it('should allow adding organizer for event you can edit', (done) => {
    const editableEvent = events.find(e => e.organizers.some(org => org.user_id === user.id));

    chai.request(server)
      .post(`/single/${editableEvent.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Good guy'
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(editableEvent.id).then((newEvent) => {
          expect(newEvent.organizers.map(org => org.user_id)).to.contain(admin.id);
          expect(newEvent.organizers.map(org => org.comment)).to.contain('Good guy');

          done();
        })
      });
  });

  it('should disallow editing organizer for event you cannot edit', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.every(org => org.user_id !== user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .put(`/single/${notEditableEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
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

  it('should disallow editing organizer if userId is not a number', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .put(`/single/${editableEvent.id}/organizers/lalala`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
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

  it('should disallow editing organizer if the user is not an organizer', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.every(org => org.user_id !== admin.id));

    chai.request(server)
      .put(`/single/${notEditableEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      })
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should allow adding organizer for event you can edit', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .put(`/single/${editableEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(editableEvent.id).then((newEvent) => {
          expect(newEvent.organizers.map(org => org.user_id)).to.contain(admin.id);
          expect(newEvent.organizers.map(org => org.comment)).to.contain('Not that good guy');

          done();
        })
      });
  });

  it('should disallow deleting organizer for event you cannot edit', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.every(org => org.user_id !== user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .del(`/single/${notEditableEvent.id}/organizers/${admin.id}`)
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

  it('should disallow deleting organizer if userId is not a number', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .del(`/single/${editableEvent.id}/organizers/lalala`)
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

  it('should disallow deleting organizer if the user is not an organizer', (done) => {
    const notEditableEvent = events.find(e =>
      e.organizers.some(org => org.user_id === user.id) && e.organizers.every(org => org.user_id !== admin.id));

    chai.request(server)
      .del(`/single/${notEditableEvent.id}/organizers/${admin.id}`)
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

  it('should disallow deleting organizer if the user is only organizer', (done) => {
    const editableEvent = events.find(e =>
      e.organizers.length === 1 && e.organizers[0].user_id === user.id);

    chai.request(server)
      .del(`/single/${editableEvent.id}/organizers/${user.id}`)
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
      e.organizers.some(org => org.user_id === user.id) && e.organizers.some(org => org.user_id === admin.id));

    chai.request(server)
      .del(`/single/${editableEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findById(editableEvent.id).then((newEvent) => {
          expect(newEvent.organizers.map(org => org.user_id)).not.to.contain(admin.id);

          done();
        })
      });
  });
});
