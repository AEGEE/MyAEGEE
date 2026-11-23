// jest globalSetup for a service whose tests check responses against its OpenAPI file:
// starts OPENAPI_HITS_FILE afresh for this run (when it is set), so that hits from an
// earlier run cannot hide a documented response that no test produces any more.
// A service with a globalSetup of its own calls resetHitsFile() from it instead.
const { resetHitsFile } = require('./openapi');

module.exports = async function globalSetup() {
    resetHitsFile();
};
