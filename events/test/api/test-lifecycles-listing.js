const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const config = require('../../lib/config/config.js');
const pseudo = require('../../lib/config/pseudo')

const should = chai.should();
chai.use(chaiHttp);

describe('Lifecycles listing', () => {
  let eventTypes;

  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    db.clear();
    const res = await db.populateLifecycles();
    eventTypes = res.eventTypes;

    omsserviceregistryStub = nock(config.registry.url + ':' + config.registry.port)
      .get('/services/omscore-nginx')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));

    omscoreStub = nock('http://omscore-nginx')
      .post('/api/tokens/user')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
  });

  it('should return lifecycles info on GET /lifecycle', (done) => {
    chai.request(server)
      .get('/lifecycle')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;

        for (const eventType of res.body.data) {
          eventType.should.have.property('_id');
          eventType.should.have.property('name');
          eventType.should.have.property('defaultLifecycle');
        }

        res.body.data.length.should.equal(eventTypes.length);

        for (const eventType of eventTypes) {
          res.body.data.map(e => e._id.toString()).should.include(eventType._id.toString());
        }

        done();
      });
  });

  it('should return lifecycles names on GET /lifecycle/names', (done) => {
    chai.request(server)
      .get('/lifecycle/names')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;

        res.body.data.length.should.equal(eventTypes.length);

        for (const eventType of eventTypes) {
          res.body.data.should.include(eventType.name);
        }

        done();
      });
  });
});
