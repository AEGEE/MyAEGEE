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
  let event;

  beforeEach(async () => {
    await db.clear();

    // Populate db
    event = await db.createEvent({ organizers: [{ user_id: 331 }] });

    mock.mockAll();
  });

  it('should disallow adding organizer for event you cannot edit', async () => {
    const notMineEvent = await db.createEvent({ organizers: [{ user_id: 1337 }] });
    mock.mockAll({ mainPermissions: { noPermissions: true } });

    const res = await chai.request(server)
      .post(`/single/${notMineEvent.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Good guy'
      });

    expect(res).to.have.status(403);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should disallow adding organizer if the user is already an organizer', async () => {
    const eventImOrganizing = await db.createEvent({ organizers: [{ user_id: admin.id }] });

    const res = await chai.request(server)
      .post(`/single/${eventImOrganizing.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Not that good guy'
      });

    expect(res).to.have.status(400);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should allow adding organizer for event you can edit', async () => {
    const res = await chai.request(server)
      .post(`/single/${event.id}/organizers/`)
      .set('X-Auth-Token', 'foobar')
      .send({
        user_id: admin.id,
        comment: 'Good guy'
      });

    expect(res).to.have.status(200);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('message');

    const newEvent = await Event.findById(event.id);
    expect(newEvent.organizers.map(org => org.user_id)).to.contain(admin.id);
    expect(newEvent.organizers.map(org => org.comment)).to.contain('Good guy');
  });

  it('should disallow editing organizer for event you cannot edit', async () => {
    const notMineEvent = await db.createEvent({ organizers: [{ user_id: 1337 }] });
    mock.mockAll({ mainPermissions: { noPermissions: true } });

    const res = await chai.request(server)
      .put(`/single/${notMineEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      });

    expect(res).to.have.status(403);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should disallow editing organizer if userId is not a number', async () => {
    const res = await chai.request(server)
      .put(`/single/${event.id}/organizers/lalala`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      });

      expect(res).to.have.status(400);
      expect(res).to.be.json;
      expect(res).to.be.a('object');

      expect(res.body.success).to.be.false;
      expect(res.body).to.have.property('message');
  });

  it('should disallow editing organizer if the user is not an organizer', async () => {
    const res = await chai.request(server)
      .put(`/single/${event.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      });

      expect(res).to.have.status(404);
      expect(res).to.be.json;
      expect(res).to.be.a('object');

      expect(res.body.success).to.be.false;
      expect(res.body).to.have.property('message');
  });

  it('should allow editing organizer for event you can edit', async () => {
    const myEvent = await db.createEvent({ organizers: [{ user_id: admin.id }] });

    const res = await chai.request(server)
      .put(`/single/${myEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        comment: 'Not that good guy'
      });

    expect(res).to.have.status(200);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('message');

    const newEvent = await Event.findById(myEvent.id);
    expect(newEvent.organizers.map(org => org.user_id)).to.contain(admin.id);
    expect(newEvent.organizers.map(org => org.comment)).to.contain('Not that good guy');
  });

  it('should disallow deleting organizer for event you cannot edit', async () => {
    const notMineEvent = await db.createEvent({ organizers: [{ user_id: 1337 }] });
    mock.mockAll({ mainPermissions: { noPermissions: true } });

    const res = await chai.request(server)
      .del(`/single/${notMineEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(403);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should disallow deleting organizer if userId is not a number', async () => {
    const res = await chai.request(server)
      .del(`/single/${event.id}/organizers/lalala`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(400);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should disallow deleting organizer if the user is not an organizer', async () => {
    const res = await chai.request(server)
      .del(`/single/${event.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(404);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should disallow deleting organizer if the user is only organizer', async () => {
    const myEvent = await db.createEvent({ organizers: [{ user_id: admin.id }] });

    const res = await chai.request(server)
      .del(`/single/${myEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(422);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should allow deleting organizer for event you can edit', async () => {
    const myEvent = await db.createEvent({ organizers: [{ user_id: admin.id }, { user_id: 1337 }] });

    const res = await chai.request(server)
      .del(`/single/${myEvent.id}/organizers/${admin.id}`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('message');

    const newEvent = await Event.findById(myEvent.id);
    expect(newEvent.organizers.map(org => org.user_id)).not.to.contain(admin.id);
  });
});
