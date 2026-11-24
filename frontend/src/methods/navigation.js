import VueRouter from 'vue-router'

const { isNavigationFailure, NavigationFailureType } = VueRouter

// For the `.catch()` of a navigation that the router guard may send elsewhere (a member with an
// incomplete profile goes to the profile page first): that redirect is the guard doing its job,
// not an error. Every other failure of the navigation is passed on.
export const ignoreRedirect = (error) => {
  if (!isNavigationFailure(error, NavigationFailureType.redirected)) {
    throw error
  }
}

// Where to go after logging in: the page in `?to=`, or the dashboard. A `to` given more than once
// is no page to go to.
export const afterLogin = (query) => (typeof query.to === 'string' && query.to ? query.to : '/dashboard')
