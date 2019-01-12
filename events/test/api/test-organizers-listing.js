const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');
const user = require('../assets/oms-core-valid').data;

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events organizer listing', () => {
  let mineEvent;
  let notMineEvent;

  beforeEach(async () => {
    await db.clear();

    mineEvent = await db.createEvent({ organizers: [{ user_id: user.id }] });
    notMineEvent = await db.createEvent({ organizers: [{ user_id: 1337 }]});

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should list events where the user is organizer on /mine/organizing GET', async () => {
    const res = await chai.request(server)
      .get('/mine/organizing')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body.data.length).to.be.equal(1);

    const ids = res.body.data.map(e => e.id);
    expect(ids.includes(mineEvent.id)).to.be.true;
  });

  it('should not include events where the user is not organizer on /mine/organizing GET', async () => {
    const res = await chai.request(server)
      .get('/mine/organizing')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;

    const ids = res.body.data.map(e => e.id);
    expect(ids.includes(notMineEvent.id)).to.be.false;
  });
});
