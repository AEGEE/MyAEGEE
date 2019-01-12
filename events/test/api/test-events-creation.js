const chai = require('chai');
const chaiHttp = require('chai-http');
const moment = require('moment');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const user = require('../assets/oms-core-valid.json').data;

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events creation', () => {
  beforeEach(async () => {
    await db.clear();
    mock.mockAll();
  });


  it('should not create a new event if the is not a member of the body', (done) => {
    mock.mockAll({ core: { notSuperadmin: true } });

    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        description: 'Test',
        application_starts: '2017-12-05 15:00',
        application_ends: '2017-12-05 15:00',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'es',
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
        description: 'Test',
        application_starts: '2017-12-05 15:00',
        application_ends: '2017-12-05 15:00',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'es'
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
        description: 'Test',
        application_starts: '2017-12-05 15:00',
        application_ends: '2017-12-05 15:00',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'es',
        body_id: user.bodies[0].id
      })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('name');
        expect(res.body.data).to.have.property('application_starts');
        expect(res.body.data).to.have.property('application_ends');
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
        expect(res.body.data.status).to.equal('draft');
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
        application_starts: '2017-12-05 15:00',
        application_ends: '2017-12-05 15:00',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'es',
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
        description: 'A training event to boost your self-confidence and teamworking skills',
        application_starts: '2017-12-05 15:00',
        application_ends: '2017-12-05 15:00',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'es',
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
        expect(res).to.have.status(201);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

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
        body_id: user.bodies[0].id,
        fee: -150
      })
      .end((err, res) => {
        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('errors');
        expect(res.body.errors).to.have.property('ends');
        expect(res.body.errors).to.have.property('name');
        expect(res.body.errors).to.have.property('fee');

        done();
      });
  });
});
