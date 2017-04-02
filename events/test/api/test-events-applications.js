const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');

const should = chai.should();
chai.use(chaiHttp);


describe('Event applications', () => {
  /* var events;

  beforeEach((done) => {
    db.clear();
    db.populateEvents((res) => {
      events = res.events;
      done();
    });
  });

  it('should list all applications to an event on /single/id/participants/ GET', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, responseEvents) => {
        const openEvent = responseEvents.body.find(x => x.application_status === 'open');

        openEvent.should.be.ok;
        chai.request(server)
          .get(`/single/${openEvent._id}/participants`)
          .set('X-Auth-Token', 'foobar')
          .end((err, res) => {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');

            res.body.should.have.lengthOf(2);
            done();
          });
      });
  });

  it('should record an application to an event on /single/id/participants/ POST', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, event) => {
        const openEvent = event.body.find(x => x.application_status === 'open');
        openEvent.should.be.ok;
        chai.request(server)
          .get(`/single/${openEvent._id}`)
          .set('X-Auth-Token', 'foobar')
          .end((err, event) => {
            chai.request(server)
              .put(`/single/${openEvent._id}/participants/mine`)
              .set('X-Auth-Token', 'foobar')
              .send({
                application: [
                  {
                    field_id: event.body.application_fields[0]._id,
                    value: 'I am super motivated',
                  }, {
                    field_id: event.body.application_fields[2]._id,
                    value: '42',
                  },
                ],
              })
              .end((err, res) => {
                res.should.have.status(201);

                Event.findById(event.body._id).exec((err, savedEvent) => {
                  savedEvent.applications.should.be.a('array');
                  var ownUserID = 'cave.johnson';
                  var ownApplication = savedEvent.applications.find(x => x.foreign_id == ownUserID);

                  ownApplication.should.be.ok;
                  ownApplication.application.should.be.a('array');
                  ownApplication.application.should.have.lengthOf(2);

                  done();
                });
              });
          });
      });
  });

  it('should return one specific application on /single/id/participants/id GET', (done) => {
    chai.request(server)
      .get('/')
      .end(function (err, event) {
        var openEvent = event.body.find(function (x) {return x.application_status == 'open';});

        openEvent.should.be.ok;
        chai.request(server)
          .get(openEvent.url)
          .end(function (err, event) {
            chai.request(server)
              .get(event.body.application_url + '/vincent.vega')
              .end(function (err, res) {
                res.should.have.status(200);
                done();
              });
          });
      });
  });

  it('should edit details of one application on /single/id/participants/id PUT'); */
});
