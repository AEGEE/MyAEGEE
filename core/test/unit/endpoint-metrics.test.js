const { buildMetricsPath } = require('../../middlewares/endpoint-metrics');

describe('endpoint metrics middleware', () => {
    test('normalizes route params to stable path labels', () => {
        expect(buildMetricsPath({
            baseUrl: '/members/42',
            path: '/my_permissions',
            route: { path: '/my_permissions' },
            params: { user_id: '42' }
        })).toEqual('/members/:user_id/my_permissions');
    });

    test('falls back to request path when no route metadata exists', () => {
        expect(buildMetricsPath({
            baseUrl: '',
            path: '/metrics/requests',
            params: {}
        })).toEqual('/metrics/requests');
    });

    test('normalizes multiple nested params in the same path', () => {
        expect(buildMetricsPath({
            baseUrl: '/bodies/7/members/8',
            path: '/permissions',
            route: { path: '/permissions' },
            params: { body_id: '7', member_id: '8' }
        })).toEqual('/bodies/:body_id/members/:member_id/permissions');
    });
});
