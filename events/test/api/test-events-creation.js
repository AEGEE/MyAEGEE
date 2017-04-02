const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');

const should = chai.should();
chai.use(chaiHttp);

describe('Events creation', () => {
  let events;

  beforeEach((done) => {
    db.clear();

    // Populate db
    db.populateEvents((res) => {
      events = res.events;
      done();
    });
  });

  it('should reject requests without X-Auth-Token', (done) => {
    chai.request(server)
      .post('/')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
        type: 'non-statutory',
      })
      .end((err, res) => {
        res.should.have.status(403);
        res.body.success.should.be.false;
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
      })
      .end((err, res) => {
        res.should.have.status(201);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;
        res.body.data[0].should.have.property('_id');
        res.body.data[0].should.have.property('name');
        res.body.data[0].should.have.property('starts');
        res.body.data[0].should.have.property('ends');
        res.body.data[0].should.have.property('application_status');
        res.body.data[0].should.have.property('max_participants');
        res.body.data[0].should.have.property('status');
        res.body.data[0].should.have.property('type');
        res.body.data[0].should.have.property('organizing_locals');
        res.body.data[0].should.have.property('description');
        res.body.data[0].should.have.property('application_fields');
        res.body.data[0].should.have.property('organizers');
        res.body.data[0].should.have.property('applications');

        // Check auto-filled fields
        res.body.data[0].status.name.should.equal('Draft');
        res.body.data[0].type.should.equal('non-statutory');
        res.body.data[0].application_status.should.equal('closed');
        res.body.data[0].application_fields.should.have.lengthOf(0);
        res.body.data[0].max_participants.should.equal(0);

        // application deadline optional when application closed
        //res.body.should.have.property('application_deadline');
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
        type: 'non-statutory',
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
        res.body.data[0].should.have.property('_id');
        res.body.data[0].should.have.property('name');
        res.body.data[0].should.have.property('starts');
        res.body.data[0].should.have.property('ends');
        res.body.data[0].should.have.property('application_deadline');
        res.body.data[0].should.have.property('application_status');
        res.body.data[0].should.have.property('max_participants');
        res.body.data[0].should.have.property('status');
        res.body.data[0].should.have.property('type');
        res.body.data[0].should.have.property('organizing_locals');
        res.body.data[0].should.have.property('description');
        res.body.data[0].should.have.property('application_fields');
        res.body.data[0].should.have.property('organizers');
        res.body.data[0].should.have.property('applications');

        res.body.data[0].application_fields.should.have.lengthOf(2);

        // Not yet implemented
        // res.body.organizers.should.have.lengthOf(1);

        done();
      });
  });

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
  });

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
        type: 'zxcazxs',
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
