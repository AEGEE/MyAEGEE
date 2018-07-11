const chai = require('chai');
const chaiHttp = require('chai-http');
const { communication } = require('oms-common-nodejs');

const server = require('../../lib/server.js');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
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
        expect(res).to.have.status(401);
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the user is unauthorized', (done) => {
    const mocked = mock.mockAll({ core: { unauthorized: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(401);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-serviceregistry is unaccessible', (done) => {
    const mocked = mock.mockAll({ registry: { netError: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-core is unaccessible', (done) => {
    const mocked = mock.mockAll({ core: { netError: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-serviceregistry returns non-JSON data', (done) => {
    const mocked = mock.mockAll({ registry: { badResponse: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-core returns non-JSON data', (done) => {
    const mocked = mock.mockAll({ core: { badResponse: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-serviceregistry returns unsuccessful response', (done) => {
    const mocked = mock.mockAll({ registry: { unsuccessfulResponse: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(500);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if the oms-core returns unsuccessful response', (done) => {
    const mocked = mock.mockAll({ core: { unsuccessfulResponse: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .get('/getUser')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(401);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail if body is not JSON', (done) => {
    chai.request(server)
      .post('/')
      .set('X-Auth-Token', 'blablabla')
      .set('Content-Type', 'application/json')
      .send('Totally not JSON')
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });

  it('should fail on accessing non-existant endpoint', (done) => {
    chai.request(server)
      .get('/nonexistant')
      .set('X-Auth-Token', 'blablabla')
      .end((err, res) => {
        expect(res).to.have.status(404);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.false;

        done();
      });
  });
});
