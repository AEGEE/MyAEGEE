const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const Event = require('../../lib/models/Event');

const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');

const should = chai.should();
chai.use(chaiHttp);

describe('Events editing', () => {
  let events;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    await db.clear();
    const res = await db.populateEvents();
    events = res.events;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should disallow event editing if the user doesn\'t have rights to do it', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        description: 'some new description',
      })
      .end((err, res) => {
        res.should.have.status(403);
        res.body.success.should.be.false;
        res.body.should.have.property('message');
        done();
      });
  });

  it('should update an event on a sane /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        description: 'some new description',
      })
      .end((err, res) => {
        res.should.have.status(200);
        done();
      });
  });

  it('should store the changes on update after a sane /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        description: 'some new description',
      })
      .end(() => {
        chai.request(server)
          .get(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .end((secondErr, res) => {
            res.body.data.description.should.equal('some new description');
            done();
          });
      });
  });

  it('should ignore superflous fields on overly detailed /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({ status: 'approved' })
      .end(() => {
        chai.request(server)
          .get(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .end((getError, res) => {
            res.should.have.status(200);
            res.body.data.status.should.not.equal('approved');

            done();
          });
      });
  });

  it('should return a validation error on malformed /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        ends: 'sometime',
      })
      .end((err, res) => {
        res.body.should.have.property('errors');
        res.body.errors.should.have.property('ends');
        done();
      });
  });

  it('should not update the organizers list with /single/<eventid> PUT', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end(() => {
        chai.request(server)
          .put(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .send({
            organizers: [
              {
                foreign_id: 'vincent.vega',
                role: 'full',
              },
            ],
          })
          .end(() => {
            Event.findById(events[0].id).exec((err, res) => {
              res.organizers.forEach(item => item.user_id.should.not.equal('vincent.vega'));
            });

            done();
          });
      });
  });

  it('should disallow event deleting if the user doesn\'t have rights', (done) => {
    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .delete(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(403);
        res.body.success.should.be.false;
        res.body.should.have.property('message');

        done();
      });
  });

  it('should hide an event from / GET but keep it for /single GET after /single DELETE', (done) => {
    // Delete one event
    chai.request(server)
      .delete(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end(() => {
        // Get that single event (should still be possible)
        chai.request(server)
          .get(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .end(function (singleErr, singleRes) {
            singleRes.should.have.status(200);
            singleRes.should.be.json;
            singleRes.should.be.a('object');

            singleRes.body.data._id.should.equal(events[0].id);
            singleRes.body.data.deleted.should.be.true;

            // Get all again, check if event is still in there
            chai.request(server)
              .get('/')
              .set('X-Auth-Token', 'foobar')
              .end((err, res) => {
                for (let i = 0; i < res.body.data.length; i++) {
                  res.body.data[i]._id.should.not.equal(events[0].id);
                }

                done();
              });
          });
      });
  });

  it('should disallow opening applications without deadline set', (done) => {
    const eventWithoutAplicationDeadline = events.find(e => !e.application_deadline);

    chai.request(server)
      .put(`/single/${eventWithoutAplicationDeadline.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        application_status: 'open',
      })
      .end((err, res) => {
        res.should.have.status(422);
        res.body.success.should.be.false;
        res.body.errors.should.have.property('application_deadline');
        done();
      });
  });

  it('should return error when start is after end', (done) => {
    const laterEvent = events.find(e => e.starts > new Date());

    chai.request(server)
      .put(`/single/${laterEvent.id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        ends: new Date(),
      })
      .end((err, res) => {
        res.should.have.status(422);
        res.body.success.should.be.false;
        res.body.errors.should.have.property('ends');
        done();
      });
  });

  it('should return error when start is before the deadline', (done) => {
    const newApplicationDeadlineDate = events[0].starts;
    newApplicationDeadlineDate.setDate(newApplicationDeadlineDate.getDate() + 365);

    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        application_deadline: newApplicationDeadlineDate,
      })
      .end((err, res) => {
        res.should.have.status(422);
        res.body.success.should.be.false;
        res.body.errors.should.have.property('application_deadline');
        done();
      });
  });
});
