// Stand-in for the mailer service. Accepts the same POST / payload the services
// send, stores it in memory and exposes it to tests:
//   GET    /__mails  -> list of received mails
//   DELETE /__mails  -> clear the list
const http = require('http');

const { PORTS } = require('./constants');

let mails = [];

const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
        if (req.method === 'POST' && req.url === '/') {
            mails.push({ ...JSON.parse(raw || '{}'), received_at: new Date().toISOString() });
            return send(res, 200, { success: true, message: 'Mail queued (fake mailer)' });
        }

        if (req.url === '/__mails' && req.method === 'GET') {
            return send(res, 200, { success: true, data: mails });
        }

        if (req.url === '/__mails' && req.method === 'DELETE') {
            mails = [];
            return send(res, 200, { success: true });
        }

        if (req.url === '/healthcheck') {
            return send(res, 200, { success: true });
        }

        return send(res, 404, { success: false, message: 'Not found' });
    });
}).listen(PORTS.mailer, '127.0.0.1');
