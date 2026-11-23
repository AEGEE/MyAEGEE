// Serving the built frontend: used by the real stack's gateway (support/gateway.ts) and by the
// static server of the mocked-API suite (ui/support/server.ts).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

// The Vue app, built by scripts/prepare.ts.
export const VUE_DIST = path.join(root, 'e2e/.frontend-dist');

// Paths that the frontend's own web server answers with a file of another name
// (frontend/docker/frontend-nginx/sites/default.conf). The status page asks for this one.
const ALIASES: Record<string, string> = { '/healthcheck': '/status.json' };

// Where a path is served from: the build directory and the path inside it. There is one
// frontend today; a second one next to it gets its paths here.
export const staticFileFor = (pathname: string): { dist: string; pathname: string } => ({ dist: VUE_DIST, pathname: ALIASES[pathname] ?? pathname });

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.map': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// The file of the build that a path names ('/' is the app's index.html), if there is one.
export const buildFile = ({ dist: distDir, pathname }: { dist: string; pathname: string }): string | undefined => {
    const file = path.join(distDir, path.normalize(pathname === '/' ? '/index.html' : pathname));
    return file.startsWith(distDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : undefined;
};

// Whether a path is a file of the frontend build, as opposed to a page of the app.
export const isBuildFile = (pathname: string): boolean => buildFile(staticFileFor(pathname)) !== undefined;

// Serves a file of a single page app build; unknown paths get its index.html.
export const serveStatic = (target: { dist: string; pathname: string }, res: import('node:http').ServerResponse): void => {
    // Single page app: unknown paths are handled by the frontend router.
    const file = buildFile(target) ?? path.join(target.dist, 'index.html');

    if (!fs.existsSync(file)) {
        res.writeHead(503);
        res.end(`The frontend in ${path.relative(root, target.dist)} is not built, run \`npm run setup\` in e2e/.`);
        return;
    }

    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
};
