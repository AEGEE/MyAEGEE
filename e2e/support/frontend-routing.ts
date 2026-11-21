// Which frontend serves a path while the Vue app and the React app (frontend-react/) run side
// by side. The list of migrated paths lives in frontend/src/migrated-routes.json, so the Vue
// router and the gateways read the same one. See docs/react-migration/03-coexistence.md.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

interface MigratedRoutes {
    patterns: string[];
    assets: string;
}

const migrated = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/migrated-routes.json'), 'utf8')) as MigratedRoutes;
const pagePatterns = migrated.patterns.map((pattern) => new RegExp(pattern));
const assetPattern = new RegExp(migrated.assets);

// The Vue app as production builds it today.
export const VUE_DIST = path.join(root, 'e2e/.frontend-dist');
// The Vue app built with VUE_APP_REACT_ROUTES=true, so its links to migrated pages load them
// from the server. Used when the React app serves those.
export const VUE_COEXIST_DIST = path.join(root, 'e2e/.frontend-coexist-dist');
export const REACT_DIST = path.join(root, 'e2e/.frontend-react-dist');

export type Frontend = 'vue' | 'react';

// `pathname` without the query string.
export const frontendFor = (pathname: string, { react }: { react: boolean }): Frontend => {
    if (!react) return 'vue';
    if (assetPattern.test(pathname)) return 'react';
    return pagePatterns.some((pattern) => pattern.test(pathname)) ? 'react' : 'vue';
};

// The build directory a path is served from.
export const distFor = (pathname: string, { react }: { react: boolean }): string => {
    if (!react) return VUE_DIST;
    return frontendFor(pathname, { react }) === 'react' ? REACT_DIST : VUE_COEXIST_DIST;
};

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// Serves a file of a single page app build; unknown paths get its index.html.
export const serveStatic = (distDir: string, pathname: string, res: import('node:http').ServerResponse): void => {
    let file = path.join(distDir, path.normalize(pathname));
    if (!file.startsWith(distDir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // Single page app: unknown paths are handled by the frontend router.
        file = path.join(distDir, 'index.html');
    }

    if (!fs.existsSync(file)) {
        res.writeHead(503);
        res.end(`The frontend in ${path.relative(root, distDir)} is not built, run \`npm run setup\` in e2e/.`);
        return;
    }

    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
};
