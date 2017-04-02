const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const Event = require('../../lib/models/Event');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events approval', () => {
  let events;
  let statuses;
  let lifecycles;

  beforeEach((done) => {
    db.clear();

    // Populate db
    db.populateEvents((res) => {
      events = res.events;
      statuses = res.statuses;
      lifecycles = res.lifecycles;
      done();
    });
  });

  it('should include the event that can be changed in approvable events', (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const status = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const event = events.find(e => e.status === status._id);

    chai.request(server)
      .get('/mine/approvable')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        const ids = res.body.data.map(e => e.id);
        expect(ids.find(id => event._id.equals(id))).to.be.ok;

        done();
      });
  });

  it('should not include the event that cannot be changed in approvable events', (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const status = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Approved');
    const event = events.find(e => e.status === status._id);

    chai.request(server)
      .get('/mine/approvable')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        const ids = res.body.data.map(e => e.id);
        expect(ids.find(id => event._id.equals(id))).to.not.exist;
        done();
      });
  });

  it('should perform status change when it\'s allowed', (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Requesting');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusTo._id)).to.be.true;
            done();
          });
      });
  });

  it('should not perform status change when the user is not allowed to do it', (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Requesting');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusFrom._id)).to.be.true;
            done();
          });
      });
  });

  it('should not perform status change when there\'s no transition', (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Approved');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusFrom._id)).to.be.true;
            done();
          });
      });
  });

  /*it('should create a new event on exhausive sane / POST', function (done) {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'foobar')
      .send({
        name: 'Develop Yourself 4',
        starts: '2017-12-11 15:00',
        ends: '2017-12-14 12:00',
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
        expect(res).to.have.status(201);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        res.body.success.should.be.true;
        res.body.event.should.have.property('_id');
        res.body.event.should.have.property('name');
        res.body.event.should.have.property('starts');
        res.body.event.should.have.property('ends');
        res.body.event.should.have.property('application_deadline');
        res.body.event.should.have.property('application_status');
        res.body.event.should.have.property('max_participants');
        res.body.event.should.have.property('status');
        res.body.event.should.have.property('type');
        res.body.event.should.have.property('organizing_locals');
        res.body.event.should.have.property('description');
        res.body.event.should.have.property('application_fields');
        res.body.event.should.have.property('organizers');
        res.body.event.should.have.property('applications');

        res.body.event.application_fields.should.have.lengthOf(2);

        // Not yet implemented
        //res.body.organizers.should.have.lengthOf(1);

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
        res.body.event.applications.should.have.lengthOf(0);

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
      })
      .end((err, res) => {
        res.body.success.should.be.false;
        res.body.should.have.property('errors');
        res.body.errors.should.have.property('ends');
        res.body.errors.should.have.property('name');

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
        expect(res).to.have.status(409);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        res.body.success.should.be.false;
        res.body.should.have.property('errors');
        res.body.should.have.property('message');
        done();
      });
  });*/
});
