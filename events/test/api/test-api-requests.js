const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('API requests', () => {
  beforeEach(async () => {
    mock.mockAll();
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
    mock.mockAll({ core: { unauthorized: true } });

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

  it('should fail if the oms-core is unaccessible', (done) => {
    mock.mockAll({ core: { netError: true } });

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
    mock.mockAll({ core: { badResponse: true } });

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
    mock.mockAll({ core: { unsuccessfulResponse: true } });

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
