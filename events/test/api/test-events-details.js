const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const config = require('../../lib/config/config.js');

const db = require('../scripts/populate-db.js');
const Event = require('../../lib/models/Event');


const should = chai.should();
chai.use(chaiHttp);

describe('Events details', () => {
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

  it('should return a single event on /single/<eventid> GET', (done) => {
    chai.request(server)
      .get(`/single/${events[0].id}`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');

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
        res.body.data.should.not.have.property('applications');

        res.body.data._id.should.equal(events[0].id);

        done();
      });
  });

  it('should return a 404 on arbitrary eventids on /single/id GET', (done) => {
    chai.request(server)
      .get('/single/12345')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(404);
        done();
      });
  });
});
