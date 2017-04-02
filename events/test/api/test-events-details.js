const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const Event = require('../../lib/models/Event');

const should = chai.should();
chai.use(chaiHttp);

describe('Events details', () => {
  var events;

  beforeEach((done) => {
    db.clear();
    db.populateEvents((res) => {
      events = res.events;
      done();
    });
  });

  // This is broken because oms-core mock doesn't have an '/api/getUser' endpoint.
  // TODO: Fix it.
  /* it('should return a single event on /single/<eventid> GET', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');


        res.body.should.have.property('_id');
        res.body.should.have.property('name');
        res.body.should.have.property('starts');
        res.body.should.have.property('ends');
        res.body.should.have.property('application_status');
        res.body.should.have.property('max_participants');
        res.body.should.have.property('status');
        res.body.should.have.property('type');
        res.body.should.have.property('organizing_locals');
        res.body.should.have.property('description');
        res.body.should.have.property('application_fields');
        // res.body.should.not.have.property('organizers');
        res.body.should.not.have.property('applications');


        res.body._id.should.equal(events[0].id);

        done();
      });
  }); */

  it('should return a 404 on arbitrary eventids on /single/id GET', (done) => {
    chai.request(server)
      .get('/single/12345')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(404);
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
      .end(function (err, res) {
        res.should.have.status(200);
        done();
      });
  });

  // The same as the 1st one, broken.
  // TODO: Fix it.
  /* it('should store the changes on update after a sane /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        description: 'some new description',
      })
      .end(function (err, res) {
        chai.request(server)
          .get(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .end(function (err, res) {
            res.body.description.should.equal('some new description');
            done();
          });
      });
  }); */

  // The same.
  /*
  it('should ignore superflous fields on overly detailed /single/<eventid> PUT', (done) => {
    chai.request(server)
      .put(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: '507f191e810c19729de860ea', // random ObjectID
      })
      .end(() => {
        chai.request(server)
          .get(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .end((getError, res) => {
            res.should.have.status(200);
            res.body.status.should.not.equal('507f191e810c19729de860ea');

            done();
          });
      });
  }); */

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

  // The same.
  /*
  it('should not update the organizers list with /single/<eventid> PUT', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, event) => {
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
          .end((err, res) => {
            Event.findById(events[0].id).exec((err, res) => {
              res.organizers.forEach(item => item.foreign_id.should.not.equal('vincent.vega'));
            });

            done();
          });
      });
  });*/

  // The same.
  /*
  it('should not update the applications list with /single/<eventid> PUT', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, event) => {
        chai.request(server)
          .put(`/single/${events[0].id}`)
          .set('X-Auth-Token', 'foobar')
          .send({
            applications: [
              {
                foreign_id: 'vincent.vega',
              },
            ],
          })
          .end((err, res) => {
            Event.findById(events[0].id).exec((err, res) => {
              res.applications.forEach(item => item.foreign_id.should.not.equal('vincent.vega'));
            });

            done();
          });
      });
  });
  */

  // Deleting doesn't work for now, so that's why I commented it out.
  /* it('should hide an event from / GET but keep it for /single GET after /single DELETE',
    (done) => {
      // Delete one event
      chai.request(server)
        .delete(`/single/${events[0].id}`)
        .set('X-Auth-Token', 'foobar')
        .end(function (err, res) {
          // Get that single event (should still be possible)
          chai.request(server)
            .get(`/single/${events[0].id}`)
            .set('X-Auth-Token', 'foobar')
            .end(function (err, res) {
              res.should.have.status(200);
              res.should.be.json;
              res.should.be.a('object');

              res.body._id.should.equal(events[0].id);
              res.body.status.should.equal('deleted');

              // Get all again, check if event is still in there
              chai.request(server)
                .get('/')
                .set('X-Auth-Token', 'foobar')
                .end((err, res) => {
                  for (let i = 0; i < res.body.length; i++) {
                    res.body[i]._id.should.not.equal(events[0].id);
                  }

                  done();
                });
            });
        });
    });*/
});
