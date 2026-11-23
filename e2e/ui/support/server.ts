// Static server for the mocked-API suite. It only serves the frontend build: every /api call
// is answered by the test itself (support/api-mock.ts), so anything reaching this server under
// /api is a request the test forgot to mock, and gets a 501.
// Usage: node ui/support/server.ts <port>
import http from 'node:http';

import { serveStatic, staticFileFor } from '../../support/frontend-routing.ts';

const [port] = process.argv.slice(2);

http.createServer((req, res) => {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    if (pathname.startsWith('/api/')) {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `Not mocked: ${req.method} ${req.url}` }));
        return;
    }

    serveStatic(staticFileFor(pathname), res);
}).listen(Number(port), '127.0.0.1');
