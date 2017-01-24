process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs-extra');
const server = require('../lib/server.js');
const db = require('./populate-db.js');
const config = require('../lib/config/config.js');

const should = chai.should();

chai.use(chaiHttp);

describe('File upload', () => {
  let events;

  beforeEach((done) => {
    db.clear();

    // Populate db
    db.populateEvents((res) => {
      events = res;
      done();
    });
  });

  after(() => {
    fs.removeSync(config.media_dir);
  });

  it('should upload a file if it\'s valid', (done) => {
    chai.request(server)
      .post(`/single/${events[0]._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/valid_image.png'), 'image.png')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.should.be.a('object');

        res.body.success.should.be.true;
        res.body.should.have.property('head_image');

        done();
      });
  });

  it('should fail if the uploaded file is not an image (by extension)');
  it('should fail if the uploaded file is not an image (by content)');
  it('should create an upload folder if it doesn\'t exist');
});
