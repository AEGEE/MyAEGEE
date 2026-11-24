const http = require('node:http');
const { Socket } = require('node:net');

// Loaded by the Jest setup before Nock patches Socket.prototype.connect.
const connect = Socket.prototype.connect;
const agent = new http.Agent({ keepAlive: false });
agent.createConnection = (options) => {
    const socket = new Socket();
    connect.call(socket, { host: options.host, port: options.port });
    return socket;
};

// Encoded bodies must reach the real service unchanged, including invalid gzip.
// Nock 15 decompresses requests before deciding whether they need a mock.
exports.unmockedRequest = (url, options) => new Promise((resolve, reject) => {
    const request = http.request(url, { ...options, agent }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
            const headers = new global.Headers();
            for (let i = 0; i < response.rawHeaders.length; i += 2) {
                headers.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
            }
            const empty = options.method === 'HEAD' || [204, 205, 304].includes(response.statusCode);
            resolve(new global.Response(empty ? null : Buffer.concat(chunks), {
                status: response.statusCode,
                statusText: response.statusMessage,
                headers
            }));
        });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('Local test request timed out')));
    request.end(options.body);
});
