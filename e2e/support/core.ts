// Read-only access to core's seed data (CommonJS, untyped) from the ESM e2e workspace.
// Tests never write to core's database directly: support/core-data.ts goes through the API.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Permissions of each general circle in the seed, as `scope:action:object` keys.
export type CirclePermissions = Record<string, string[]>;

export const loadSeedPermissions = (): { CIRCLE_PERMISSIONS: CirclePermissions } => require('../../core/scripts/seed-permissions.js');
