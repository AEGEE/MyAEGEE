import Vue from 'vue'
import axios from 'axios'
import VueAxios from 'vue-axios'
import NProgress from 'vue-nprogress'
import { sync } from 'vuex-router-sync'
import Buefy from 'buefy'
import bugsnag from 'bugsnag-js'
import bugsnagVue from 'bugsnag-vue'

import App from './App.vue'
import router from './router'
import store from './store'
import * as filters from './filters'
import { TOGGLE_SIDEBAR } from 'vuex-store/mutation-types'
import Auth from './auth'

Vue.router = router
Vue.use(VueAxios, axios)
Vue.use(Auth)
Vue.use(NProgress)
Vue.use(Buefy, { defaultNoticeQueue: false, defaultIconPack: 'fa' })

// Enable devtools
Vue.config.devtools = true

sync(store, router)

const nprogress = new NProgress({ parent: '.nprogress-container' })

const { state } = store

router.beforeEach((route, redirect, next) => {
  if (state.app.device.isMobile && state.app.sidebar.opened) {
    store.commit(TOGGLE_SIDEBAR, false)
  }

  // Skipping fetching user if going to page that doesn't require authorization
  if (!route.meta.auth) {
    return next()
  }

  router.app.$auth.fetchUserWithExistingData().then(() => {
    document.title = 'OMS | ' + route.meta.label
    return next()
  }).catch((err) => {
    console.log('Error fetching user, redirect to /login. Error: ' + err)
    return next('/login')
  })
})

axios.interceptors.request.use(config => {
  const token = window.localStorage.getItem('access-token')
  config.headers['X-Auth-Token'] = token
  return config
})

Object.keys(filters).forEach(key => {
  Vue.filter(key, filters[key])
})

// Report errors with Bugsnag
const bugsnagClient = bugsnag('c9ce5a05c60e8d35a7a9f04fe3ec98b0')
bugsnagClient.use(bugsnagVue(Vue))


const app = new Vue({
  router,
  store,
  nprogress,
  ...App
})

export { app, router, store }
