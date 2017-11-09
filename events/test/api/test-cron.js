const chai = require('chai');
const tk = require('timekeeper');
const cron = require('../../lib/cron');
const db = require('../scripts/populate-db');
const Event = require('../../lib/models/Event');

const should = chai.should();

const sleep = delay => new Promise(res => setTimeout(res, delay));

describe('Cron testing', () => {
  let events;

  beforeEach(async () => {
    db.clear();

    // Populate db
    const res = await db.populateEvents();
    events = res.events;
  });

  it('should register deadline for all events', async () => {
    const plannedEventsCount = events
      .filter(e => e.application_status === 'open' && e.starts > Date.now())
      .length;

    await cron.scanDB();
    cron.countJobs().should.equal(plannedEventsCount);
  });

  it('should close the deadline for passed event', async () => {
    const openEvents = events.filter(e => e.application_status === 'open'
      && e.application_deadline && e.application_deadline > Date.now());
    openEvents.length.should.be.above(0);

    // Setting date to 1 year from now
    const newDate = new Date((new Date()).setFullYear((new Date()).getFullYear() + 1));
    tk.travel(newDate);

    await cron.scanDB();

    // Ugly, but don't know how to fix yet, since we don't have
    // the callback for closeDeadline() function.
    await sleep(1000);
    cron.countJobs().should.equal(0);
    tk.reset();
  });
});
