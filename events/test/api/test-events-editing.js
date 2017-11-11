const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const config = require('../../lib/config/config.js');

const db = require('../scripts/populate-db.js');

const should = chai.should();
chai.use(chaiHttp);

describe('Events editing', () => {
  let events;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    db.clear();
    const res = await db.populateEvents();
    events = res.events;

    omsserviceregistryStub = nock(config.registry.url + ':' + config.registry.port)
      .get('/services/omscore-nginx')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));

    omscoreStub = nock('http://omscore-nginx')
      .post('/api/tokens/user')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
  });

  afterEach(async () => {
    nock.cleanAll();
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
  it('should store the changes on update after a sane /single/<eventid> PUT'/* , (done) => {
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
  }*/);

  // The same.
  
  it('should ignore superflous fields on overly detailed /single/<eventid> PUT'/*, (done) => {
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
  }*/);

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
  
  it('should not update the organizers list with /single/<eventid> PUT'/*, (done) => {
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
  }*/);

  it('should hide an event from / GET but keep it for /single GET after /single DELETE', (done) => {
    nock.cleanAll();

    omsserviceregistryStub = nock(config.registry.url + ':' + config.registry.port)
      .get('/services/omscore-nginx')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));

    omscoreStub = nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));

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
});
