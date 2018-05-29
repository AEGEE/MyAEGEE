const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const user = require('../assets/oms-core-valid.json').data;

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events creation', () => {
  let events;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    await db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should not create a new event if the user doesn\'t have rights / POST', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
        body_id: user.bodies[0].id
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

  it('should not create a new event if the is not a member of the body', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
        body_id: 1337
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

  it('should not create a new event if body_id is not provided', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory'
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

  it('should create a new event on minimal sane / POST', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('name');
        expect(res.body.data).to.have.property('starts');
        expect(res.body.data).to.have.property('ends');
        expect(res.body.data).to.have.property('application_status');
        expect(res.body.data).to.have.property('max_participants');
        expect(res.body.data).to.have.property('status');
        expect(res.body.data).to.have.property('type');
        expect(res.body.data).to.have.property('organizing_locals');
        expect(res.body.data).to.have.property('description');
        expect(res.body.data).to.have.property('application_fields');
        expect(res.body.data).to.have.property('organizers');

        // Check auto-filled fields
        expect(res.body.data.status.name).to.equal('Draft');
        expect(res.body.data.type).to.equal('non-statutory');
        expect(res.body.data.application_status).to.equal('closed');
        expect(res.body.data.application_fields).to.have.lengthOf(0);
        expect(res.body.data.max_participants).to.equal(0);

        done();
      });
  });

  it('should create a new event on exhausive sane / POST', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
        description: 'A training event to boost your self-confidence and teamworking skills',
        organizing_locals: [{ foreign_id: 'AEGEE-Dresden' }],
        max_participants: 22,
        application_deadline: '2015-11-30',
        application_fields: [
          {
            name: 'What is the greatest local',
            description: 'Tell something about which AEGEE-Local is the best',
          },
          {
            name: 'What is the meaning of life',
            description: 'Please be concise',
          },
        ],
        body_id: user.bodies[0].id,
        application_status: 'closed',
      })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('name');
        expect(res.body.data).to.have.property('starts');
        expect(res.body.data).to.have.property('ends');
        expect(res.body.data).to.have.property('application_deadline');
        expect(res.body.data).to.have.property('application_status');
        expect(res.body.data).to.have.property('max_participants');
        expect(res.body.data).to.have.property('status');
        expect(res.body.data).to.have.property('type');
        expect(res.body.data).to.have.property('organizing_locals');
        expect(res.body.data).to.have.property('description');
        expect(res.body.data).to.have.property('application_fields');
        expect(res.body.data).to.have.property('organizers');

        expect(res.body.data.application_fields).to.have.lengthOf(2);

        expect(res.body.data.organizers).to.have.lengthOf(1);
        expect(res.body.data.organizing_locals).to.have.lengthOf(1);

        done();
      });
  });

  // TODO: Implement
  it('should discart superflous fields on overly detailed / POST', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
        organizers: [
          {
            user_id: 3,
            body_id: 5,
            role: 'full',
          },
        ],
        applications: [
          {
            user_id: 5,
            body_id: 10,
            status: 'accepted',
          },
        ],
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res.body.data.applications).to.have.lengthOf(0);

        // Not implemented yet
        expect(res.body.data.organizers).to.have.lengthOf(1);
        expect(res.body.data.organizers[0].user_id).to.not.equal(3);

        done();
      });
  });

  it('should return validation errors on malformed / POST', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        starts: '2015-12-11 15:00',
        ends: 'sometime, dunno yet',
        type: 'non-statutory',
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('errors');
        expect(res.body.errors).to.have.property('ends');
        expect(res.body.errors).to.have.property('name');

        done();
      });
  });

  it('should fail if there\'s no event type specified', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should fail if there\'s no such event type', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'random-event-type',
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');
        done();
      });
  });
});
