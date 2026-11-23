// The areas the suite is organised by: one per directory of frontend/src/views/, plus `shell`
// for everything else in frontend/src/ (components, methods, store, router, filters).
// Specs, smoke data, the axe baseline and the coverage gate are all kept per area.
export const AREAS = ['auth', 'core', 'dashboard', 'discounts', 'events', 'network', 'resources', 'shell', 'static', 'statutory', 'summeruniversity'] as const;

export type Area = typeof AREAS[number];

export const isArea = (value: string): value is Area => (AREAS as readonly string[]).includes(value);
