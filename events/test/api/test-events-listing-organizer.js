const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const user = require('../assets/oms-core-valid').data;

const should = chai.should();
chai.use(chaiHttp);

describe('Events organizer listing', () => {
  let events;
  let omscoreStub;
  let omsserviceregistryStub;

  beforeEach(async () => {
    db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should list events where the user is organizer on /mine/byOrganizer GET', (done) => {
    const mineEvents = events.filter((event) => {
      return event.organizers.some(org => org.foreign_id === user.id);
    });

    chai.request(server)
      .get('/mine/byOrganizer')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;

        res.body.success.should.be.true;
        res.body.data.length.should.be.equal(mineEvents.length);

        const ids = res.body.data.map(e => e.id);
        for (const event of mineEvents) {
          ids.indexOf(event.id).should.not.be.equal(-1);
        }

        done();
      });
  });

  it('should not include events where the user is not organizer on /mine/byOrganizer GET', (done) => {
    const notMineEvents = events.filter((event) => {
      return event.organizers.some(org => org.foreign_id !== user.id);
    });

    chai.request(server)
      .get('/mine/byOrganizer')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;

        res.body.success.should.be.true;

        const ids = res.body.data.map(e => e.id);
        for (const event of notMineEvents) {
          ids.indexOf(event.id).should.be.equal(-1);
        }

        done();
      });
  });
});
