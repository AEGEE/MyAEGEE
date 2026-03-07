const { buildMetricsPath } = require('../../lib/endpoints_metrics');

describe('network endpoint metrics', () => {
    test('normalizes route params to stable path labels', () => {
        expect(buildMetricsPath({
            baseUrl: '/bodies/7/boards',
            path: '/19',
            route: { path: '/:board_id' },
            params: { body_id: '7', board_id: '19' }
        })).toEqual('/bodies/:body_id/boards/:board_id');
    });

    test('falls back to request path when route metadata is missing', () => {
        expect(buildMetricsPath({
            baseUrl: '',
            path: '/metrics/requests',
            params: {}
        })).toEqual('/metrics/requests');
    });

    test('normalizes nested param segments independently', () => {
        expect(buildMetricsPath({
            baseUrl: '/antennaCriteria/9',
            path: '/details/4',
            route: { path: '/details/:criterion_id' },
            params: { agora_id: '9', criterion_id: '4' }
        })).toEqual('/antennaCriteria/:agora_id/details/:criterion_id');
    });
});
