const chai = require('chai');
const chaiHttp = require('chai-http');

const server = require('../../lib/server.js');
const db = require('../scripts/populate-db.js');
const mock = require('../scripts/mock-core-registry');

const should = chai.should();
chai.use(chaiHttp);

describe('Events/users rights', () => {
  let events;

  beforeEach(async () => {
    await db.clear();
    const res = await db.populateEvents();
    events = res.events;

    mock.mockAll();
  });

  it('should allow everything for the user who is superadmin', (done) => {
    chai.request(server)
      .get('/single/' + events[0].id + '/rights')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.body.success.should.be.true;

        res.body.data.is.superadmin.should.be.true;
        res.body.data.special.should.include('Superadmin');

        // Only superadmin should be able to edit lifecycles.
        res.body.data.can.edit_lifecycles.should.be.true;
        res.body.data.can.delete_lifecycles.should.be.true;

        done();
      });
  });

  it('should allow event editing for the user who is superadmin but not organizer', (done) => {
    chai.request(server)
      .get('/single/' + events[1].id + '/rights')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.body.success.should.be.true;
        res.body.data.is.superadmin.should.be.true;
        res.body.data.is.organizer.should.be.false;

        res.body.data.can.edit_organizers.should.be.true;
        res.body.data.can.edit_details.should.be.true;
        res.body.data.can.delete.should.be.true;
        res.body.data.can.edit_application_status.should.be.true;
        res.body.data.can.edit.should.be.true;
        res.body.data.can.approve_participants.should.be.true;

        done();
      });
  });

  it('should allow event editing for the user who is not superadmin', (done) => {
    mock.mockAll({ core: { notSuperadmin: true } });

    chai.request(server)
      .get('/single/' + events[1].id + '/rights')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.body.success.should.be.true;
        res.body.data.is.organizer.should.be.true;
        res.body.data.is.superadmin.should.be.false;
        res.body.data.special.should.not.include('Superadmin');
        res.body.data.special.should.include('Organizer');

        res.body.data.can.edit_organizers.should.be.true;
        res.body.data.can.edit_details.should.be.true;
        res.body.data.can.delete.should.be.true;
        res.body.data.can.edit_application_status.should.be.true;
        res.body.data.can.edit.should.be.true;
        res.body.data.can.approve_participants.should.be.true;

        done();
      });
  });

  it('should not allow event editing for the user who is neither superadmin nor organizer', (done) => {
    mock.mockAll({ core: { notSuperadmin: true } });

    chai.request(server)
      .get('/single/' + events[2].id + '/rights')
      .set('X-Auth-Token', 'foobar')
      .end((err, res) => {
        res.body.success.should.be.true;
        res.body.data.is.organizer.should.be.false;
        res.body.data.is.superadmin.should.be.false;

        res.body.data.can.edit_organizers.should.be.false;
        res.body.data.can.edit_details.should.be.false;
        res.body.data.can.delete.should.be.false;
        res.body.data.can.edit_application_status.should.be.false;
        res.body.data.can.edit.should.be.false;
        res.body.data.can.approve_participants.should.be.false;

        done();
      });
  });
});
