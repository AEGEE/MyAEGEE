const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const Event = require('../../lib/models/Event');
const helpers = require('../../lib/helpers');

const user = require('../assets/oms-core-valid').data;
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;
chai.use(chaiHttp);

describe('Events approval', () => {
  let events;
  let eventTypes;

  let omscoreStub;
  let omsserviceregistryStub;

  // TODO: Fix all of these.
  beforeEach(async () => {
    db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;
    eventTypes = res.eventTypes;

    const mocked = mock.mockAll();
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;
  });

  it('should include the event that can be changed in approvable events', (done) => {
    const accessibleEvents = events.filter((event) => {
      return event.lifecycle.transitions.some((transition) => {
        return transition.from === event.status.name
          && helpers.canUserAccess(user, transition.allowedFor, event);
      });
    });

    chai.request(server)
      .get('/mine/approvable')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.lengthOf(accessibleEvents.length);

        for (const event of accessibleEvents) {
          expect(res.body.data.map(e => e._id).indexOf(event._id.toString())).to.not.equal(-1);
        }

        done();
      });
  });

  it('should not include the event that cannot be changed in approvable events', (done) => {
    const notAccessibleEvents = events.filter((event) => {
      return event.lifecycle.transitions.filter((transition) => {
        return transition.from === event.status.name
          && helpers.canUserAccess(user, transition.allowedFor, event);
      }).length === 0;
    });

    chai.request(server)
      .get('/mine/approvable')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.true;

        const ids = notAccessibleEvents.map(e => e._id.toString());

        for (const id of ids) {
          expect(res.body.data.map(e => e._id).indexOf(id)).to.equal(-1);
        }

        done();
      });
  });

  it('should perform status change when it\'s allowed'/*, (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Requesting');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusTo._id)).to.be.true;
            done();
          });
      });
  }*/);

  it('should not perform status change when the user is not allowed to do it'/*, (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Requesting');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusFrom._id)).to.be.true;
            done();
          });
      });
  }*/);

  it('should not perform status change when there\'s no transition'/*, (done) => {
    const lifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
    const statusFrom = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Draft');
    const statusTo = statuses.find(s => lifecycle.status.includes(s._id) && s.name === 'Approved');
    const event = events.find(e => e.status === statusFrom._id);

    chai.request(server)
      .put(`/single/${event.id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusTo._id,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: event._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.equals(statusFrom._id)).to.be.true;
            done();
          });
      });
  }*/);
});
