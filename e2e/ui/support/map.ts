// Pages with a map (Mapbox) fetch a style from MapTiler before the map fires `load`. This
// answers that request with an empty style, so the map loads without the internet.
import type { ApiMock } from './api-mock.ts';

// frontend/src/credentials.js
const STYLE_URL = 'https://api.maptiler.com/maps/basic/style.json*';

export const mockMap = (api: ApiMock): void => {
    api.url('GET', STYLE_URL, {
        json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } }] }
    });
};
