// The Vue app's routes (frontend/src/router/routes.js, read at build time), so links and titles
// match. `href()` builds a path from a route name like the Vue router's named routes.
import { routes as vueRoutes, type VueRoute } from 'virtual:vue-app';

const byName = new Map<string, VueRoute>(vueRoutes.map((route) => [route.name, route]));

export const vueRoute = (name: string): VueRoute => {
    const route = byName.get(name);
    if (!route) throw new Error(`Unknown route ${name}`);
    return route;
};

export const href = (name: string, params: Record<string, string | number> = {}): string => vueRoute(name).path
    .replace(/:(\w+)\??/g, (_, key: string) => encodeURIComponent(String(params[key] ?? '')))
    .replace(/\/$/, '') || '/';

export const pageTitle = (name: string): string => `MyAEGEE | ${vueRoute(name).label}`;
