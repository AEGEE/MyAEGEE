const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Socket } = require('node:net');

const { unmockedRequest } = require('../unmocked-request');

test('sends malformed encoded bytes to the service without running socket interceptors', async () => {
    const bytes = Buffer.from('not gzip at all');
    let received;
    const server = http.createServer((request, response) => {
        const chunks = [];
        request.on('data', (chunk) => chunks.push(chunk));
        request.on('end', () => {
            received = Buffer.concat(chunks);
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false }));
        });
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const connect = Socket.prototype.connect;
    Socket.prototype.connect = () => { throw new Error('The socket interceptor must not see this request'); };

    try {
        const response = await unmockedRequest(`http://127.0.0.1:${server.address().port}/`, {
            method: 'PUT',
            headers: { 'Content-Encoding': 'gzip' },
            body: bytes
        });

        assert.equal(response.status, 400);
        assert.equal(response.statusText, 'Bad Request');
        assert.equal(response.headers.get('content-type'), 'application/json');
        assert.deepEqual(await response.json(), { success: false });
        assert.deepEqual(received, bytes);
    } finally {
        Socket.prototype.connect = connect;
        await new Promise((resolve) => { server.close(resolve); });
    }
});

test('keeps an empty response body and repeated response headers', async () => {
    const server = http.createServer((request, response) => {
        response.writeHead(204, { 'Set-Cookie': ['first=one', 'second=two'] });
        response.end();
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });

    try {
        const response = await unmockedRequest(`http://127.0.0.1:${server.address().port}/`, { method: 'DELETE' });

        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        assert.deepEqual(response.headers.getSetCookie(), ['first=one', 'second=two']);
    } finally {
        await new Promise((resolve) => { server.close(resolve); });
    }
});
