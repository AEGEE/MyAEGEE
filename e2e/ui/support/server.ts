// Static server for the mocked-API suite. It only serves the frontend build: its files, and the
// app's index.html for a page navigation (the router of the app takes it from there). Every
// /api call is answered by the test itself (support/api-mock.ts), so anything reaching this
// server under /api is a request the test forgot to mock, and gets a 501. Anything else that is
// neither a file of the build nor a navigation gets a 404: a request to `/apii/…` or `/api`
// must not look like a page that loaded.
// Usage: node ui/support/server.ts <port>
import http from 'node:http';

import { buildFile, serveStatic, staticFileFor } from '../../support/frontend-routing.ts';

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

    const target = staticFileFor(pathname);
    // A browser that goes to a page asks for HTML; a fetch() of the app, or a tool, doesn't.
    const navigation = (req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept ?? '').includes('text/html');
    if (!navigation && !buildFile(target) && buildFile(staticFileFor('/'))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `Not found: ${req.method} ${req.url} is neither a file of the frontend build nor a page navigation` }));
        return;
    }

    serveStatic(target, res);
}).listen(Number(port), '127.0.0.1');
