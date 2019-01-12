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
  let event;

  beforeEach(async () => {
    await db.clear();

    event = await db.createEvent();
    mock.mockAll();
  });

  after(() => {
    fs.removeSync(config.media_dir);
  });

  it('should create an upload folder if it doesn\'t exist', async () => {
    fs.removeSync(config.media_dir);

    await chai.request(server)
      .post(`/single/${event._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/valid_image.png'), 'image.png');

    expect(fs.existsSync(config.media_dir)).to.be.true;
  });

  it('should fail if the uploaded file is not an image (by extension)', async () => {
    const res = await chai.request(server)
      .post(`/single/${event._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/invalid_image.txt'), 'image.txt');

    expect(res).to.have.status(422);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should fail if the uploaded file is not an image (by content)', async () => {
    const res = await chai.request(server)
      .post(`/single/${event._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/invalid_image.jpg'), 'image.jpg');

    expect(res).to.have.status(422);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should fail the \'head_image\' field is not specified', async () => {
    const res = await chai.request(server)
      .post(`/single/${event._id}/upload`)
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(422);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.false;
    expect(res.body).to.have.property('message');
  });

  it('should upload a file if it\'s valid', async () => {
    const res = await chai.request(server)
      .post(`/single/${event._id}/upload`)
      .set('X-Auth-Token', 'foobar')
      .attach('head_image', fs.readFileSync('./test/assets/valid_image.png'), 'image.png');

    expect(res).to.have.status(200);
    expect(res).to.be.json;
    expect(res).to.be.a('object');

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');

    expect(fs.existsSync(path.join(__dirname, '..', '..', res.body.data.path))).to.be.true;
  });
});
