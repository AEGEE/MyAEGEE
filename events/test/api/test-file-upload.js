const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs-extra');
const path = require('path');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const config = require('../../lib/config/config');

const expect = chai.expect;
chai.use(chaiHttp);

describe('File upload', () => {
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

  after(() => {
    fs.removeSync(config.media_dir);
  });

  it('should create an upload folder if it doesn\'t exist', (done) => {
    fs.removeSync(config.media_dir);

    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/valid_image.png'), 'image.png')
      .end((err) => {
        expect(fs.existsSync(config.media_dir)).to.be.true;
        done();
      });
  });

  it('should fail if the uploaded file is not an image (by extension)', (done) => {
    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/invalid_image.txt'), 'image.txt')
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should fail if the uploaded file is not an image (by content)', (done) => {
    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/invalid_image.jpg'), 'image.jpg')
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should fail the \'head_image\' field is not specified', (done) => {
    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(422);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        done();
      });
  });

  it('should upload a file if it\'s valid', (done) => {
    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/valid_image.png'), 'image.png')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');

        expect(fs.existsSync(path.join(__dirname, '..', '..', res.body.data.path))).to.be.true;

        done();
      });
  });
});
