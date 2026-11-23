// Routing for the dev server when the stack runs without Traefik
// (MYAEGEE_GATEWAY=devserver). It mirrors the Traefik labels in each service's
// docker/docker-compose.yml: the prefix is stripped and the request goes to the
// container on the OMS network. Keep the two in sync when routes change.
//
// Differences from Traefik, on purpose for local development:
// - /api/<service>/metrics needs no basic auth;
// - the legacy /services/oms-* routes are left out, nothing uses them.

const internal = {
  '/api/core': 'http://core:8084',
  '/api/events': 'http://events:8084',
  '/api/statutory': 'http://statutory:8084',
  '/api/summeruniversity': 'http://summeruniversity:8084',
  '/api/discounts': 'http://discounts:8084',
  '/api/network': 'http://network:8084',
  '/media/core': 'http://core-static:80',
  '/media/events': 'http://events-static:80',
  '/media/statutory': 'http://statutory-static:80',
  '/media/summeruniversity': 'http://summeruniversity-static:80'
}

// CORS proxies that Traefik defines in gateways/docker/traefik/traefik.toml.*.
const external = {
  '/services/jira-cors': 'https://myaegee.atlassian.net',
  '/services/calendar-cors': 'https://calendar.google.com',
  '/services/dockerhub': 'https://hub.docker.com'
}

// vue-cli takes an object keyed by a regex on the path. Anchor it on a whole
// path segment, so /api/core never catches /api/corex.
const route = (prefix, target, options = {}) => [`^${prefix}(/|$)`, {
  target,
  pathRewrite: (path) => path.slice(prefix.length) || '/',
  logLevel: 'warn',
  ...options
}]

module.exports = Object.fromEntries([
  // Traefik only exposes the mailer's healthcheck.
  ['^/api/mailer/healthcheck$', { target: 'http://mailer:4000', pathRewrite: { '^/api/mailer': '' }, logLevel: 'warn' }],
  ...Object.entries(internal).map(([prefix, target]) => route(prefix, target)),
  ...Object.entries(external).map(([prefix, target]) => route(prefix, target, { changeOrigin: true, xfwd: false }))
])
