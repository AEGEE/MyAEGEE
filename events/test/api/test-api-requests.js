const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const mock = require('../scripts/mock-core-registry');

const should = chai.should();
chai.use(chaiHttp);

describe('API requests', () => {
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
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
