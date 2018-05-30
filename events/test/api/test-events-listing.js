const chai = require('chai');
const chaiHttp = require('chai-http');
const tk = require('timekeeper');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events listing', () => {
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

  it('should list all events on / GET', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data[0]).to.have.property('_id');
        expect(res.body.data[0]).to.have.property('name');
        expect(res.body.data[0]).to.have.property('starts');
        expect(res.body.data[0]).to.have.property('ends');
        expect(res.body.data[0]).to.have.property('application_status');
        expect(res.body.data[0]).to.have.property('status');
        expect(res.body.data[0]).to.have.property('type');
        expect(res.body.data[0]).to.have.property('description');

        done();
      });
  });

  it('should include the event that is visible to the user', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        // The second event should be visible to user
        // and it should be included into events listing.
        expect(res.body.data.filter(e => e._id === events[1].id).length).to.equal(1);

        done();
      });
  });

  it('should not include the event that is not visible to the user', (done) => {
    chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        // The first event shouldn't be visible to user
        // and it shouldn't be included into events listing.
        expect(res.body.data.filter(e => e._id === events[0].id).length).to.equal(0);

        done();
      });
  });

  it('should use the default limit if limit is NaN', (done) => {
    chai.request(server)
      .get('/?limit=nan')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).not.to.equal(1);
        expect(res.body.meta.limit).not.to.equal('nan');
        expect(res.body.meta.moreAvailable).to.be.false;

        done();
      });
  });

  it('should use the default limit if limit is < 0', (done) => {
    chai.request(server)
      .get('/?limit=-1')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).not.to.equal(1);
        expect(res.body.meta.limit).not.to.equal(-1);
        expect(res.body.meta.moreAvailable).to.be.false;

        done();
      });
  });

  it('should work with limit if limit is > 0', (done) => {
    chai.request(server)
      .get('/?limit=1')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).to.equal(1);
        expect(res.body.meta.limit).to.equal(1);
        expect(res.body.meta.moreAvailable).to.be.true;

        done();
      });
  });

  it('should use the default offset if offset is NaN', (done) => {
    chai.request(server)
      .get('/?offset=nan')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).not.to.equal(1);
        expect(res.body.meta.offset).not.to.equal('nan');
        expect(res.body.meta.moreAvailable).to.be.false;

        done();
      });
  });

  it('should use the default offset if offset is < 0', (done) => {
    chai.request(server)
      .get('/?offset=-1')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).not.to.equal(1);
        expect(res.body.meta.offset).not.to.equal(-1);
        expect(res.body.meta.moreAvailable).to.be.false;

        done();
      });
  });

  it('should work with offset if offset is > 0', (done) => {
    chai.request(server)
      .get('/?offset=100')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).to.equal(0);
        expect(res.body.meta.offset).to.equal(100);
        expect(res.body.meta.moreAvailable).to.be.false;

        done();
      });
  });

  it('should display only specified event types if specified and if multiple types are specified', (done) => {
    const types = ['non-statutory'];

    chai.request(server)
      .get('/?' + types.map(type => 'type[]=' + type).join('&'))
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        const eventTypes = res.body.data.map(e => e.type);
        for (const type of eventTypes) {
          expect(types).to.include(type);
        }

        done();
      });
  });

  it('should display only specified event types if specified and if single type is specified', (done) => {
    chai.request(server)
      .get('/?type=statutory')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        for (const event of res.body.data) {
          expect(event.type).to.equal('statutory');
        }

        done();
      });
  });

  it('should not display past events if displayPast=false', (done) => {
    const newDate = new Date((new Date()).setFullYear((new Date()).getFullYear() + 1));
    tk.travel(newDate);

    chai.request(server)
      .get('/?displayPast=false')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).to.be.equal(0);

        tk.reset();

        done();
      });
  });

  it('should display past events if displayPast=true', (done) => {
    const newDate = new Date((new Date()).setFullYear((new Date()).getFullYear() + 1));
    tk.travel(newDate);

    chai.request(server)
      .get('/?displayPast=true')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        expect(res.body.data.length).to.be.greaterThan(0);

        tk.reset();

        done();
      });
  });
});
