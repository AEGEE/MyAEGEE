const chai = require('chai');
const chaiHttp = require('chai-http');
const tk = require('timekeeper');
const moment = require('moment');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events listing', () => {
  beforeEach(async () => {
    await db.clear();

    mock.mockAll();
  });

  it('should list all published on / GET', async () => {
    const event = await db.createEvent({ status: 'published' });
    await db.createEvent({ status: 'draft' });

    const res = await chai.request(server)
      .get('/')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.be.a('array');

    expect(res.body.data.length).to.equal(1);

    expect(res.body.data[0]).to.have.property('_id');
    expect(res.body.data[0]).to.have.property('name');
    expect(res.body.data[0]).to.have.property('starts');
    expect(res.body.data[0]).to.have.property('ends');
    expect(res.body.data[0]).to.have.property('application_status');
    expect(res.body.data[0]).to.have.property('status');
    expect(res.body.data[0]).to.have.property('type');
    expect(res.body.data[0]).to.have.property('description');

    expect(res.body.data[0]._id).to.equal(event._id.toString());
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

  it('should use the default limit if limit is < 0', async () => {
    await db.createEvent({ status: 'published' });

    const res = await chai.request(server)
      .get('/?limit=-1')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.be.a('array');

    expect(res.body.data.length).not.to.equal(-1);
    expect(res.body.meta.limit).not.to.equal(-1);
    expect(res.body.meta.moreAvailable).to.be.false;
  });

  it('should work with limit if limit is > 0', async  () => {
    await db.createEvent({ status: 'published' });
    await db.createEvent({ status: 'published' });

    const res = await chai.request(server)
      .get('/?limit=1')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.be.a('array');

    expect(res.body.data.length).to.equal(1);
    expect(res.body.meta.limit).to.equal(1);
    expect(res.body.meta.moreAvailable).to.be.true;
  });

  it('should use the default offset if offset is NaN', async () => {
    const res = await chai.request(server)
      .get('/?offset=nan')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.be.a('array');

    expect(res.body.data.length).not.to.equal(1);
    expect(res.body.meta.offset).not.to.equal('nan');
    expect(res.body.meta.moreAvailable).to.be.false;
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

  it('should display past events if displayPast=true', async () => {
    await db.createEvent({
      application_starts: moment().subtract(5, 'week').toDate(),
      application_ends: moment().subtract(4, 'week').toDate(),
      starts: moment().subtract(3, 'week').toDate(),
      ends: moment().subtract(2, 'week').toDate(),
      status: 'published'
    })

    const res = await chai.request(server)
      .get('/?displayPast=true')
      .set('X-Auth-Token', 'foobar');

    expect(res).to.have.status(200);
    expect(res).to.be.json;

    expect(res.body.success).to.be.true;
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.be.a('array');

    expect(res.body.data.length).to.be.greaterThan(0);
  });

  it('should filter by name case-insensitive', (done) => {
    chai.request(server)
      .get('/?search=nwm')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        for (const event of res.body.data) {
          expect(event.name.toLowerCase()).to.contain('nwm');
        }

        done();
      });
  });

  it('should filter by description case-insensitive', (done) => {
    chai.request(server)
      .get('/?search=action agenda')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('array');

        for (const event of res.body.data) {
          expect(event.description.toLowerCase()).to.contain('action agenda');
        }

        done();
      });
  });
});
