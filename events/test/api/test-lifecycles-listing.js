const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');

const should = chai.should();
chai.use(chaiHttp);

describe('Lifecycles listing', () => {
  let eventTypes;

  beforeEach((done) => {
    db.clear();
    db.populateLifecycles((res) => {
      eventTypes = res.eventTypes;

      done();
    });
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
});
