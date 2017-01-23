process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../lib/server.js');
var should = chai.should();
var db = require('./populate-db.js');

module.exports = function () {
  var events;

  beforeEach((done) => {
    db.clear();
    db.populateEvents(function (res) {
      events = res;
      done();
    });
  });

  it('should list all applications to an event on /single/id/participants/ GET', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, responseEvents) => {
        const closedEvent = responseEvents.body.find(x => x.application_status === 'closed');

        console.log(responseEvents.body);
        closedEvent.should.be.ok;
        chai.request(server)
          .get(closedEvent.application_url)
          .end((err, res) => {
            console.log(err)
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
      .end((err, event) => {
        const openEvent = event.body.find(x => x.application_status === 'open');

        openEvent.should.be.ok;
        chai.request(server)
          .get(openEvent.url)
          .end((err, event) => {
            chai.request(server)
              .post(event.body.application_url)
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
              .end(function (err, res) {
                res.should.have.status(201);

                Event.findById(event.body._id).exec(function (err, savedEvent) {
                  savedEvent.applications.should.be.a('array');
                  var ownUserID = 'cave.johnson';
                  var ownApplication = savedEvent.applications.find(
                    function (x) {return x.foreign_id == ownUserID;});

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

  it('should edit details of one application on /single/id/participants/id PUT');
};
