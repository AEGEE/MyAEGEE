const chai = require('chai');
const chaiHttp = require('chai-http');
const nock = require('nock');
const path = require('path');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const config = require('../../lib/config/config.js');

const should = chai.should();
chai.use(chaiHttp);

describe('API requests', () => {
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

  it('should reject requests without X-Auth-Token', (done) => {
    chai.request(server)
      .get('/getUser')
      .end((err, res) => {
        res.should.have.status(403);
        res.body.success.should.be.false;

        done();
      });
  });

  it('should fail if the user is unauthorized');
  it('should fail if the oms-serviceregistry is unaccessible');
  it('should fail if the oms-core is unaccessible');
});
