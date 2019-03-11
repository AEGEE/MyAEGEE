import Vue from 'vue'
import Router from 'vue-router'

import routes from './routes'

Vue.use(Router)

export default new Router({
  mode: 'history',
  linkActiveClass: 'is-active',
  scrollBehavior: () => ({ y: 0 }),
  routes: [
    ...defaultRoutes(routes),
    {
      path: '*',
      redirect: '/dashboard'
    }
  ]
})

function exists (val) { return typeof val !== 'undefined' }
function setDefault (val, defaultVal) { return exists(val) ? val : defaultVal }
function lazyLoading (name) { return () => import(`views/${name}.vue`) }

// Setting default values for routes
// I've removed non-lazy-loading for now, as it's not working with Webpack 4 somehow.
function defaultRoutes (routes) {
  return routes.map(route => ({
    name: route.name,
    component: lazyLoading(route.component),
    path: route.path,
    meta: {
      label: route.meta.label,
      auth: setDefault(route.meta.auth, true),
      skipLazyLoad: setDefault(route.meta.skipLazyLoad, false),
      showSidebar: setDefault(route.meta.showSidebar, true)
    }
  }))
}
