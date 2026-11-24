// Pages with a map (Mapbox) fetch a style from MapTiler before the map fires `load`. This
// answers that request with an empty style, so the map loads without the internet.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { VUE_DIST } from '../../support/frontend-routing.ts';
import type { ApiMock } from './api-mock.ts';

// frontend/src/credentials.js
const STYLE_URL = 'https://api.maptiler.com/maps/basic/style.json*';

export const mockMap = (api: ApiMock): void => {
    api.url('GET', STYLE_URL, {
        json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } }] }
    });
};

// Lets the file of the build that holds mapbox-gl arrive late, as on a slow connection, to see
// what a page does when its map is taken away before the library has loaded. The file is found
// by a message of mapbox-gl's own. Resolves once the page has the file.
export const delayMapLibrary = (page: Page, api: ApiMock, delayMs = 2500): Promise<unknown> => {
    const dir = path.join(VUE_DIST, 'js');
    const file = fs.readdirSync(dir).find((name) => name.endsWith('.js') && fs.readFileSync(path.join(dir, name), 'utf8').includes('must be a String or HTMLElement'));
    if (!file) throw new Error(`No file of the build in ${dir} holds mapbox-gl: build the frontend first`);
    api.url('GET', `/js/${file}`, { body: fs.readFileSync(path.join(dir, file)), contentType: 'application/javascript', delayMs });
    return page.waitForResponse((response) => new URL(response.url()).pathname === `/js/${file}`);
};
