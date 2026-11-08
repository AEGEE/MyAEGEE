// Access to core's CommonJS modules (models, seed data) from the ESM e2e workspace.
// They have no type definitions, so only the parts the e2e tests use are typed here.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Permissions of each general circle in the seed, as `scope:action:object` keys.
export type CirclePermissions = Record<string, string[]>;

export const loadSeedPermissions = (): { CIRCLE_PERMISSIONS: CirclePermissions } => require('../../core/scripts/seed-permissions.js');

// Sequelize models and helpers; only used by scripts/core-fixtures.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadCoreModels = (): Record<string, any> => require('../../core/models/index.js');
export const loadCoreSequelize = (): { authenticate: () => Promise<void>; close: () => Promise<void> } => require('../../core/lib/sequelize.js');
