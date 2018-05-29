const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const user = require('../assets/oms-core-valid').data;

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events organizer listing', () => {
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

  it('should list events where the user is organizer on /mine/organizing GET', (done) => {
    const mineEvents = events.filter(event => event.organizers.some(org => org.user_id === user.id));

    chai.request(server)
      .get('/mine/organizing')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body.data.length).to.be.equal(mineEvents.length);

        const ids = res.body.data.map(e => e.id);
        for (const event of mineEvents) {
          expect(ids.includes(event.id)).to.be.true;
        }

        done();
      });
  });

  it('should not include events where the user is not organizer on /mine/organizing GET', (done) => {
    const notMineEvents = events.filter(event => event.organizers.every(org => org.user_id !== user.id));

    chai.request(server)
      .get('/mine/organizing')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;

        const ids = res.body.data.map(e => e.id);
        for (const event of notMineEvents) {
          expect(ids.includes(event.id)).to.be.false;
        }

        done();
      });
  });
});
