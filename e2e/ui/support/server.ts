// Static server for the mocked-API suite. It only serves the frontend builds: every /api call
// is answered by the test itself (support/api-mock.ts), so anything reaching this server under
// /api is a request the test forgot to mock, and gets a 501.
// Usage: node ui/support/server.ts <port> vue|react
//   vue:   everything from the Vue build;
//   react: migrated paths from the React build, the rest from the Vue build (like production).
import http from 'node:http';

import { distFor, serveStatic } from '../../support/frontend-routing.ts';

const [port, mode] = process.argv.slice(2);
const react = mode === 'react';

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

    serveStatic(distFor(pathname, { react }), pathname, res);
}).listen(Number(port), '127.0.0.1');
