const http = require('http');

// A server that takes requests and never answers them, like a mailer that hangs.
// `requests` counts what it received; `close()` drops the open connections.
exports.startSilentServer = () => new Promise((resolve) => {
    const state = { requests: 0 };
    const server = http.createServer(() => {
        state.requests += 1;
    });

    server.listen(0, '127.0.0.1', () => resolve({
        port: server.address().port,
        get requests() {
            return state.requests;
        },
        close: () => new Promise((done) => {
            server.closeAllConnections();
            server.close(done);
        })
    }));
});
