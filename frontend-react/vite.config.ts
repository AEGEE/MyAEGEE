import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const vueSrc = path.resolve(import.meta.dirname, '../frontend/src');
const require = createRequire(import.meta.url);

// The route table and sidebar menu of the Vue app, so this app uses the same page titles and
// links and shows the same menu while both apps run side by side, and the list of paths the
// gateway sends to this app (frontend/src/migrated-routes.json). Read at build time;
// `import { routes, menu, migratedPatterns } from 'virtual:vue-app'` in the code.
const vueApp = (): Plugin => ({
    name: 'myaegee-vue-app',
    resolveId: (id) => (id === 'virtual:vue-app' ? '\0virtual:vue-app' : null),
    load(id) {
        if (id !== '\0virtual:vue-app') return null;
        const routesFile = path.join(vueSrc, 'router/routes.js');
        const menuFile = path.join(vueSrc, 'menu.json');
        const migratedFile = path.join(vueSrc, 'migrated-routes.json');
        [routesFile, menuFile, migratedFile].forEach((file) => this.addWatchFile(file));
        delete require.cache[routesFile];
        const routes = (require(routesFile) as { name: string; path: string; meta: { label: string; auth?: boolean } }[])
            .map(({ name, path: routePath, meta }) => ({ name, path: routePath, label: meta.label, auth: meta.auth !== false }));
        const menu = require(menuFile) as unknown;
        // The paths the gateway sends to this app; everything else is the Vue app's.
        const { patterns } = require(migratedFile) as { patterns: string[] };
        return [
            `export const routes = ${JSON.stringify(routes)};`,
            `export const menu = ${JSON.stringify(menu)};`,
            `export const migratedPatterns = ${JSON.stringify(patterns)};`
        ].join('\n');
    }
});

export default defineConfig({
    // Assets live under /react/ so the gateway can tell them apart from the Vue app's.
    base: '/react/',
    plugins: [react(), vueApp()],
    server: {
        port: 8081,
        // For `npm run dev` against a running stack (./start.sh): the APIs, and the Vue app for
        // every page this app doesn't serve, come from the gateway.
        proxy: {
            '/api': process.env.MYAEGEE_GATEWAY_URL ?? 'http://localhost'
        }
    },
    test: {
        environment: 'jsdom'
    }
});
