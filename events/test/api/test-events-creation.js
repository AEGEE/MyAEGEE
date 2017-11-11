const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const config = require('../../lib/config/config.js');

const should = chai.should();
chai.use(chaiHttp);

describe('Events creation', () => {
  let events;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;

    omsserviceregistryStub = nock(config.registry.url + ':' + config.registry.port)
      .get('/services/omscore-nginx')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));

    omscoreStub = nock('http://omscore-nginx')
      .post('/api/tokens/user')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
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
      })
      .end((err, res) => {
        res.should.have.status(201);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;
        res.body.data.should.have.property('_id');
        res.body.data.should.have.property('name');
        res.body.data.should.have.property('starts');
        res.body.data.should.have.property('ends');
        res.body.data.should.have.property('application_status');
        res.body.data.should.have.property('max_participants');
        res.body.data.should.have.property('status');
        res.body.data.should.have.property('type');
        res.body.data.should.have.property('organizing_locals');
        res.body.data.should.have.property('description');
        res.body.data.should.have.property('application_fields');
        res.body.data.should.have.property('organizers');

        // Check auto-filled fields
        res.body.data.status.name.should.equal('Draft');
        res.body.data.type.should.equal('non-statutory');
        res.body.data.application_status.should.equal('closed');
        res.body.data.application_fields.should.have.lengthOf(0);
        res.body.data.max_participants.should.equal(0);

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
        application_status: 'closed',
      })
      .end((err, res) => {
        res.should.have.status(201);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;
        res.body.data.should.have.property('_id');
        res.body.data.should.have.property('name');
        res.body.data.should.have.property('starts');
        res.body.data.should.have.property('ends');
        res.body.data.should.have.property('application_deadline');
        res.body.data.should.have.property('application_status');
        res.body.data.should.have.property('max_participants');
        res.body.data.should.have.property('status');
        res.body.data.should.have.property('type');
        res.body.data.should.have.property('organizing_locals');
        res.body.data.should.have.property('description');
        res.body.data.should.have.property('application_fields');
        res.body.data.should.have.property('organizers');

        res.body.data.application_fields.should.have.lengthOf(2);

        res.body.data.organizers.should.have.lengthOf(1);
        res.body.data.organizing_locals.should.have.lengthOf(1);

        done();
      });
  });

  // TODO: Implement
  it('should discart superflous fields on overly detailed / POST'/*, (done) => {
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
            foreign_id: 'eve.mallory',
            role: 'full',
          },
        ],
        applications: [
          {
            foreign_id: 'eve.mallory',
            application_status: 'approved',
          },
        ],
      })
      .end((err, res) => {
        res.body.data[0].applications.should.have.lengthOf(0);

        // Not implemented yet
        // res.body.organizers.should.have.lengthOf(1);
        // res.body.organizers[0].foreign_id.should.not.equal('eve.mallory');

        done();
      });
  }*/);

  it('should return validation errors on malformed / POST', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        starts: '2015-12-11 15:00',
        ends: 'sometime, dunno yet',
        type: 'non-statutory',
      })
      .end((err, res) => {
        res.body.success.should.be.false;
        res.body.should.have.property('errors');
        res.body.errors.should.have.property('ends');
        res.body.errors.should.have.property('name');

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
      })
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;
        res.body.should.have.property('message');
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
      })
      .end((err, res) => {
        res.should.have.status(409);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.false;
        res.body.should.have.property('message');
        done();
      });
  });
});
