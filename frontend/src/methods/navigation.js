// Where to go after logging in: the page in `?to=`, or the dashboard. A `to` given more than once
// is no page to go to.
export const afterLogin = (query) => (typeof query.to === 'string' && query.to ? query.to : '/dashboard')
