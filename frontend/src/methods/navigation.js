import VueRouter from 'vue-router'

const { isNavigationFailure } = VueRouter

// For the `.catch()` of a navigation the app starts by itself: one that doesn't happen is no
// error. The router guard may send it elsewhere (a member with an incomplete profile goes to the
// profile page first), a second click may start the same navigation again, or the page asked for
// may be the page shown. Anything that isn't a failure of the navigation (an exception in a guard
// or a page that can't be loaded) is passed on.
export const ignoreNavigationFailure = (error) => {
  if (!isNavigationFailure(error)) {
    throw error
  }
}

// Where to go after logging in: the page in `?to=`, or the dashboard. A `to` given more than once
// is no page to go to.
export const afterLogin = (query) => (typeof query.to === 'string' && query.to ? query.to : '/dashboard')
