const express = require('express');
const router = require('express-promise-router');
const bodyParser = require('body-parser');
const boolParser = require('express-query-boolean');

const config = require('../config');
const log = require('./logger');
const morgan = require('./morgan');
const middlewares = require('./middlewares');
const db = require('./sequelize');
const events = require('./events');
const applications = require('./applications');
const memberslists = require('./memberslists');
const massmailer = require('./massmailer');
const paxLimits = require('./pax_limits');
const votesAmounts = require('./votes_amounts');
const positions = require('./positions');
const questionLines = require('./question_lines');
const questions = require('./questions');
const candidates = require('./candidates');
const plenaries = require('./plenaries');
const bugsnag = require('./bugsnag');
const cron = require('./cron');
const imageserv = require('./imageserv');
const metrics = require('./metrics');
const endpointsMetrics = require('./endpoints_metrics');

const GeneralRouter = router({ mergeParams: true });
const PaxLimitsRouter = router({ mergeParams: true });
const EventsRouter = router({ mergeParams: true });
const ApplicationsRouter = router({ mergeParams: true });
const SingleApplicationRouter = router({ mergeParams: true });
const MembersListsRouter = router({ mergeParams: true });
const MassMailerRouter = router({ mergeParams: true });
const VotesAmountRouter = router({ mergeParams: true });
const PositionsRouter = router({ mergeParams: true });
const CandidatesRouter = router({ mergeParams: true });
const PlenariesRouter = router({ mergeParams: true });
const QuestionLinesRouter = router({ mergeParams: true });
const QuestionsRouter = router({ mergeParams: true });

const server = express();
server.use(bodyParser.json());
server.use(boolParser());
server.use(morgan);

/* istanbul ignore next */
process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection: %s', err.stack);

    if (process.env.NODE_ENV !== 'test') {
        bugsnag.notify(err);
    }
});

GeneralRouter.get('/healthcheck', middlewares.healthcheck);
GeneralRouter.get('/metrics', metrics.getMetrics);
GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);
GeneralRouter.use(middlewares.authenticateUser);
GeneralRouter.get('/', events.listEvents);
GeneralRouter.use(middlewares.ensureAuthorized);
GeneralRouter.post('/', events.addEvent);
GeneralRouter.get('/tasks', middlewares.getTasksList);

PaxLimitsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, paxLimits.checkEventType);
PaxLimitsRouter.get('/:body_id', paxLimits.getSingleLimit);
PaxLimitsRouter.delete('/:body_id', paxLimits.deleteSingleLimit);
PaxLimitsRouter.post('/', paxLimits.updateLimit);
PaxLimitsRouter.get('/', paxLimits.listAllLimits);

EventsRouter.use(middlewares.authenticateUser, middlewares.fetchEvent);
EventsRouter.get('/', events.displayEvent);
EventsRouter.get('/fields/applications/all', events.getApplicationAllFields);
EventsRouter.get('/fields/applications/incoming', events.getApplicationIncomingFields);
EventsRouter.get('/fields/candidates', events.getCandidatesFields);
EventsRouter.use(middlewares.ensureAuthorized);
EventsRouter.put('/', events.editEvent);
EventsRouter.put('/status', events.changeEventStatus);
EventsRouter.post('/image', imageserv.uploadImage, events.updateEventImage);

ApplicationsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent);
ApplicationsRouter.post('/', applications.postApplication);
ApplicationsRouter.get('/all', applications.listAllApplications);
ApplicationsRouter.get('/accepted', applications.listAcceptedApplications);
ApplicationsRouter.get('/juridical', applications.listJCApplications);
ApplicationsRouter.get('/incoming', applications.listIncomingApplications);
ApplicationsRouter.get('/network', applications.listNetworkApplications);
ApplicationsRouter.get('/stats', applications.getStats);
ApplicationsRouter.get('/export/openslides', applications.exportOpenslides);
ApplicationsRouter.get('/export/:prefix', applications.exportAll);
ApplicationsRouter.get('/boardview/:body_id', applications.listBoardView);
ApplicationsRouter.post('/boardview/:body_id', applications.setBoardForBody);

SingleApplicationRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, middlewares.fetchSingleApplication);
SingleApplicationRouter.put('/cancel', applications.setApplicationCancelled);
SingleApplicationRouter.put('/attended', applications.setApplicationAttended);
SingleApplicationRouter.put('/registered', applications.setApplicationRegistered);
SingleApplicationRouter.put('/departed', applications.setApplicationDeparted);
SingleApplicationRouter.put('/confirmed', applications.setApplicationConfirmed);
SingleApplicationRouter.put('/is_on_memberslist', applications.setApplicationIsOnMemberslist);
SingleApplicationRouter.put('/status', applications.setApplicationStatus);
SingleApplicationRouter.put('/board', applications.setApplicationBoard);
SingleApplicationRouter.get('/', applications.getApplication);
SingleApplicationRouter.put('/', applications.updateApplication);

MembersListsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, memberslists.checkIfAgora);
MembersListsRouter.get('/', memberslists.getAllMemberslists);
MembersListsRouter.get('/:body_id', memberslists.getMemberslist);
MembersListsRouter.post('/:body_id', memberslists.uploadMembersList);

MembersListsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent);
MembersListsRouter.get('/', memberslists.getAllMemberslists);
MembersListsRouter.get('/:body_id', memberslists.getMemberslist);
MembersListsRouter.put('/:body_id/fee_paid', memberslists.setMemberslistFeePaid);
MembersListsRouter.post('/:body_id', memberslists.uploadMembersList);

MassMailerRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent);
MassMailerRouter.post('/', massmailer.sendAll);

VotesAmountRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, memberslists.checkIfAgora);
VotesAmountRouter.get('/antenna', votesAmounts.getAllVotesPerAntenna);
VotesAmountRouter.get('/delegate', votesAmounts.getAllVotesPerDelegate);
VotesAmountRouter.get('/:body_id', votesAmounts.getVotesPerAntenna);

PositionsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, memberslists.checkIfAgora);
PositionsRouter.get('/', positions.listAllPositions);
PositionsRouter.get('/export', positions.exportAll);
PositionsRouter.get('/all', positions.listPositionsWithAllCandidates);
PositionsRouter.get('/approved', positions.listPositionsWithApprovedCandidates);
PositionsRouter.post('/', positions.createPosition);
PositionsRouter.put('/:position_id/status', positions.findPosition, positions.updatePositionStatus);
PositionsRouter.put('/:position_id', positions.findPosition, positions.editPosition);
PositionsRouter.get('/candidates/mine', candidates.getMyCandidatures);

QuestionLinesRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent);
QuestionLinesRouter.get('/', questionLines.listAllQuestionLines);
QuestionLinesRouter.post('/', questionLines.createQuestionLine);
QuestionLinesRouter.put('/:question_line_id/status', questionLines.findQuestionLine, questionLines.updateQuestionLineStatus);
QuestionLinesRouter.put('/:question_line_id', questionLines.findQuestionLine, questionLines.editQuestionLine);
QuestionLinesRouter.delete('/:question_line_id', questionLines.findQuestionLine, questionLines.deleteQuestionLine);

QuestionsRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, questionLines.findQuestionLine);
QuestionsRouter.post('/', questions.submitQuestion);
QuestionsRouter.get('/:question_id', questions.findQuestion, questions.getQuestion);
QuestionsRouter.put('/:question_id', questions.findQuestion, questions.editQuestion);
QuestionsRouter.delete('/:question_id', questions.findQuestion, questions.deleteQuestion);

CandidatesRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, memberslists.checkIfAgora, positions.findPosition);
CandidatesRouter.post('/', candidates.submitYourCandidature);
CandidatesRouter.get('/:candidate_id', candidates.findCandidate, candidates.getCandidature);
CandidatesRouter.put('/:candidate_id', candidates.findCandidate, candidates.editCandidature);
CandidatesRouter.post('/:candidate_id/:image', candidates.findCandidate, imageserv.uploadImage, candidates.updateCandidateImage);
CandidatesRouter.put('/:candidate_id/status', candidates.findCandidate, candidates.setCandidatureStatus);

PlenariesRouter.use(middlewares.authenticateUser, middlewares.ensureAuthorized, middlewares.fetchEvent, memberslists.checkIfAgora);
PlenariesRouter.get('/', plenaries.listAllPlenaries);
PlenariesRouter.post('/', plenaries.createPlenary);
PlenariesRouter.get('/stats', plenaries.listPlenariesStats);
PlenariesRouter.put('/:plenary_id', plenaries.findPlenary, plenaries.editPlenary);
PlenariesRouter.get('/:plenary_id', plenaries.findPlenaryWithAttendances);
PlenariesRouter.post('/:plenary_id/attendance/mark', plenaries.findPlenary, plenaries.markPlenaryAttendance);

server.use(endpointsMetrics.addEndpointMetrics);
server.use('/events/:event_id/massmailer', MassMailerRouter);
server.use('/events/:event_id/memberslists', MembersListsRouter);
server.use('/events/:event_id/question-lines', QuestionLinesRouter);
server.use('/events/:event_id/question-lines/:question_line_id/questions', QuestionsRouter);
server.use('/events/:event_id/applications', ApplicationsRouter);
server.use('/events/:event_id/applications/:application_id', SingleApplicationRouter);
server.use('/events/:event_id', EventsRouter);
server.use('/events/:event_id/votes-amounts', VotesAmountRouter);
server.use('/events/:event_id/plenaries', PlenariesRouter);
server.use('/events/:event_id/positions/:position_id/candidates', CandidatesRouter);
server.use('/events/:event_id/positions', PositionsRouter);
server.use('/limits/:event_type', PaxLimitsRouter);
server.use('/', GeneralRouter);

server.use(middlewares.notFound);
server.use(middlewares.errorHandler);

let app;
async function startServer() {
    return new Promise((res, rej) => {
        log.info('Starting server with the following config: %o', config);
        const localApp = server.listen(config.port, async () => {
            app = localApp;
            log.info('Up and running, listening on http://localhost:%d', config.port);
            await db.authenticate();
            await cron.registerAllDeadlines();
            return res();
        });
        /* istanbul ignore next */
        localApp.on('error', err => rej(new Error('Error starting server: ' + err.stack)));
    });
}

async function stopServer() {
    log.info('Stopping server...');
    app.close();
    /* istanbul ignore next */
    if (process.env.NODE_ENV !== 'test') await db.close();
    app = null;
}

module.exports = {
    app,
    server,
    stopServer,
    startServer
};
