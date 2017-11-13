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

  it('should list possible statuses on GET /single/:id/status', (done) => {
    const possibleStatuses = events[0].lifecycle.statuses.filter((status) => {
      return events[0].lifecycle.transitions.some((transition) => {
        return transition.from === events[0].status.name
          && transition.to === status.name
          && helpers.canUserAccess(user, transition.allowedFor, events[0]);
      });
    });

    chai.request(server)
      .get('/single/' + events[0]._id + '/status')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');
        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.lengthOf(possibleStatuses.length);

        const names = possibleStatuses.map(s => s.name);
        const gotNames = res.body.data.map(t => t.to.name);

        for (const name of names) {
          expect(gotNames.indexOf(name)).not.to.equal(-1);
        }

        done();
      });
  });

  it('should perform status change when it\'s allowed', (done) => {
    const possibleStatuses = events[0].lifecycle.statuses.filter((status) => {
      return events[0].lifecycle.transitions.some((transition) => {
        return transition.from === events[0].status.name
          && transition.to === status.name
          && helpers.canUserAccess(user, transition.allowedFor, events[0]);
      });
    });

    const statusToChangeTo = possibleStatuses[0].name;

    chai.request(server)
      .put(`/single/${events[0].id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusToChangeTo,
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.true;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: events[0]._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.name).to.be.equal(statusToChangeTo);
            done();
          });
      });
  });

  it('should not perform status change when the user is not allowed to do it', (done) => {
    const possibleStatuses = events[0].lifecycle.statuses.filter((status) => {
      return events[0].lifecycle.transitions.some((transition) => {
        return transition.from === events[0].status.name
          && transition.to === status.name
          && helpers.canUserAccess(user, transition.allowedFor, events[0]);
      });
    });

    const statusToChangeTo = possibleStatuses[0].name;

    const mocked = mock.mockAll({ core: { notSuperadmin: true } });
    omscoreStub = mocked.omscoreStub;
    omsserviceregistryStub = mocked.omsserviceregistryStub;

    chai.request(server)
      .put(`/single/${events[0].id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusToChangeTo,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: events[0]._id }).then((eventFromDb) => {
          expect(eventFromDb.status.name).not.to.equal(statusToChangeTo);
          done();
        });
      });
  });

  it('should not perform status change when there\'s no transition', (done) => {
    const statusWithoutTransition = events[0].lifecycle.statuses.find((status) => {
      return status.name !== events[0].status.name && events[0].lifecycle.transitions.filter((transition) => {
        return transition.from === events[0].status.name && transition.to === status.name;
      }).length === 0;
    }).name;

    chai.request(server)
      .put(`/single/${events[0].id}/status`)
      .set('X-Auth-Token', 'foobar')
      .send({
        status: statusWithoutTransition,
      })
      .end((err, res) => {
        expect(res).to.have.status(403);
        expect(res).to.be.json;
        expect(res).to.be.a('object');

        expect(res.body.success).to.be.false;
        expect(res.body).to.have.property('message');

        Event.findOne({ _id: events[0]._id })
          .then((eventFromDb) => {
            expect(eventFromDb.status.name).not.to.be.equal(statusWithoutTransition);
            done();
          });
      });
  });
});
