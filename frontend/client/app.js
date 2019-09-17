import Vue from 'vue'
import axios from 'axios'
import VueAxios from 'vue-axios'
import { sync } from 'vuex-router-sync'
import Buefy from 'buefy'
import * as VueGoogleMaps from 'vue2-google-maps'
import flatPickr from 'vue-flatpickr-component'
import Multiselect from 'vue-multiselect'
import InputTag from 'vue-input-tag'
import qs from 'qs'
import Vue2TouchEvents from 'vue2-touch-events'
import '@fortawesome/fontawesome-free/js/all.js'

import App from './App.vue'
import NProgress from './scripts/vue-nprogress'
import router from './router'
import store from './store'
import filters from './filters'
import Auth from './auth'
import SelectOrCustom from './components/SelectOrCustom'
import PasswordToggle from './components/PasswordToggle'
import EmptyTableStub from './components/EmptyTableStub'

axios.defaults.paramsSerializer = params => qs.stringify(params, {
  arrayFormat: 'brackets',
  encode: false,
  encodeValuesOnly: true
})

Vue.router = router
Vue.use(VueAxios, axios)
Vue.use(Auth)
Vue.use(NProgress)
Vue.use(Buefy, { defaultNoticeQueue: false, defaultIconPack: 'fa' })
Vue.use(flatPickr)
Vue.use(VueGoogleMaps, {
  load: {
    key: 'AIzaSyBbo9L1-AW0DSuo0IolsyZweKU9hX6lKE0',
    libraries: 'places,drawing,visualization,geometry'
  }
})
Vue.use(Vue2TouchEvents)
Vue.component('multiselect', Multiselect)
Vue.component('input-tag', InputTag)
Vue.component('select-or-custom', SelectOrCustom)
Vue.component('password-toggle', PasswordToggle)
Vue.component('empty-table-stub', EmptyTableStub)


// Enable devtools
Vue.config.devtools = true
Vue.config.performance = true

sync(store, router)

const nprogress = new NProgress({ parent: '.nprogress-container' })

const { state } = store

router.beforeEach((route, redirect, next) => {
  // Workaround to not go into endless fetching user cycle
  if (redirect.name || route.name === 'oms.login') {
    console.log('Skipping workaround for login...')
    return next()
  }

  // If user if fetched, just redirect.
  if (state.login.user) {
    document.title = 'MyAEGEE | ' + route.meta.label
    return state.login.isLoggedIn
        ? next()
        : next('/login')
  }

  // Fetching user if not fetched.
  return router.app.$auth.fetchUserWithExistingData().then(() => {
    if (!state.login.isLoggedIn && route.meta.auth) {
      throw new Error('Trying to access the auth-only page while being unauthorized.');
    }

    document.title = 'MyAEGEE | ' + route.meta.label
    return next()
  }).catch((err) => {
    console.log('Error fetching user, redirect to /login. Error: ' + err)

    // Allow unauthorized users to access if allowed.
    if (!route.meta.auth) {
      console.log('The endpoint is allowed by unauthorized user, not redirecting.')
      return next()
    }

    return next('/login')
  })
})

axios.interceptors.request.use(config => {
  const token = window.localStorage.getItem('access-token')
  config.headers['X-Auth-Token'] = token
  return config
})

axios.interceptors.response.use(
  response => response, // success handler
  error => {
    let originalRequest = error.config
    if (axios.isCancel(error) || !error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    console.log('Token expired, renewing...')
    originalRequest._retry = true

    const refreshToken = window.localStorage.getItem('refresh-token')
    if (!refreshToken) {
      console.log('No refresh token provided')
      router.push('/login')
      return Promise.reject(error)
    }

    return Vue.axios.post(state.services['oms-core-elixir'] + '/renew', { refresh_token: refreshToken }).then((result) => {
      console.log('Renew access token successfully.')

      window.localStorage.setItem('access-token', result.data.access_token)
      originalRequest.headers['X-Auth-Token'] = result.data.access_token
      return axios(originalRequest)
    })
  }
)

Object.keys(filters).forEach(key => {
  Vue.filter(key, filters[key])
})

const app = new Vue({
  router,
  store,
  nprogress,
  ...App
})

export { app, router, store }
