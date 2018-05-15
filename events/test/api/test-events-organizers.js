const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const Event = require('../../lib/models/Event');
const db = require('../scripts/populate-db');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Event organizers', () => {
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


  it('should list all contributing organizers on /single/:id/organizers GET'/*, (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, event) => {
        chai.request(server)
          .get(`/single/${event.body[0]._id}/organizers`)
          .end((err, res) => {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');

            res.body.length.should.be.at.least(1);

            done();
          });
      });
  }*/);

  it('should change the organizers list on /single/:id/organizers PUT'/*, (done) => {
    chai.request(server)
      .get('/')
      .end((err, event) => {
        chai.request(server)
          .put(event.body[0].organizer_url)
          .send({ organizers: [
            {
              foreign_id: 'cave.johnson',
              role: 'full',
            }, {
              foreign_id: 'vincent.vega',
              role: 'full',
            },
          ] })
        .end((err, res) => {
          res.should.have.status(200);

          chai.request(server)
            .get(event.body[0].organizer_url)
            .end((err, res) => {
              res.should.have.status(200);
              res.should.be.json;
              res.body.should.be.a('array');

              res.body.should.have.lengthOf(2);
              res.body[0].foreign_id.should.equal('cave.johnson');
              res.body[1].foreign_id.should.equal('vincent.vega');
              done();
            });
        });
      });
  }*/);

  it('should not allow to empty the organizers list on /single/id/organizers PUT'/*, (done) => {
    chai.request(server)
     .get('/')
     .end(function (err, event) {
      chai.request(server)
       .put(event.body[0].organizer_url)
       .send({ organizers: [] })
       .end(function (err, res) {

        res.should.have.status(422);
        done();
      });
    });
  }*/);

  it('should return a validation error on malformed /single/id/organizers PUT'/*, (done) => {
    chai.request(server)
     .get('/')
     .end(function (err, event) {
      chai.request(server)
       .put(event.body[0].organizer_url)
       .send({ organizers: [
         {
          somefield: 'foo',
        },
        ], })
       .end(function (err, res) {
        res.should.have.status(422);
        done();
      });
    });
  }*/);
});
