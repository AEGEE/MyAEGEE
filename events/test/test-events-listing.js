process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../lib/server.js');
const db = require('./populate-db.js');

chai.use(chaiHttp);

describe('Events listing', () => {
  let events;

  beforeEach((done) => {
    db.clear();

    // Populate db
    db.populateEvents((res) => {
      events = res;
      done();
    });
  });

  it('should reject requests without X-Auth-Token', (done) => {
    chai.request(server)
      .get('/')
      .end((err, res) => {
        res.should.have.status(403);
        done();
      });
  });

  it('should list all events on / GET', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('array');

        res.body[0].should.have.property('_id');
        res.body[0].should.have.property('name');
        res.body[0].should.have.property('starts');
        res.body[0].should.have.property('ends');
        res.body[0].should.have.property('application_status');
        res.body[0].should.have.property('status');
        res.body[0].should.have.property('type');
        res.body[0].should.have.property('description');

        done();
      });
  });
});
