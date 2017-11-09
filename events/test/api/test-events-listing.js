const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const config = require('../../lib/config/config.js');


const should = chai.should();
chai.use(chaiHttp);

describe('Events listing', () => {
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

  it('should list all events on / GET', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;

        res.body.success.should.be.true;
        res.body.should.have.property('data');
        res.body.data.should.be.a('array');

        res.body.data[0].should.have.property('_id');
        res.body.data[0].should.have.property('name');
        res.body.data[0].should.have.property('starts');
        res.body.data[0].should.have.property('ends');
        res.body.data[0].should.have.property('application_status');
        res.body.data[0].should.have.property('status');
        res.body.data[0].should.have.property('type');
        res.body.data[0].should.have.property('description');

        done();
      });
  });

  it('should include the event that is visible to the user', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;

        res.body.success.should.be.true;
        res.body.should.have.property('data');
        res.body.data.should.be.a('array');

        // The second event should be visible to user
        // and it should be included into events listing.
        res.body.data.filter(e => e._id === events[1].id).length.should.equal(1);

        done();
      });
  });

  it('should not include the event that is not visible to the user', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;

        res.body.success.should.be.true;
        res.body.should.have.property('data');
        res.body.data.should.be.a('array');

        // The first event shouldn;t be visible to user
        // and it shouldn't be included into events listing.
        res.body.data.filter(e => e._id === events[0].id).length.should.equal(0);

        done();
      });
  });
});
