import Vue from 'vue'
import axios from 'axios'
import VueAxios from 'vue-axios'
import NProgress from 'vue-nprogress'
import { sync } from 'vuex-router-sync'
import Buefy from 'buefy'
import * as VueGoogleMaps from 'vue2-google-maps'
import flatPickr from 'vue-flatpickr-component'
import Multiselect from 'vue-multiselect'
import InputTag from 'vue-input-tag'
import qs from 'qs'
import '@fortawesome/fontawesome-free/js/all.js'

import App from './App.vue'
import router from './router'
import store from './store'
import filters from './filters'
import Auth from './auth'

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
Vue.component('multiselect', Multiselect)
Vue.component('input-tag', InputTag)

// Enable devtools
Vue.config.devtools = true

sync(store, router)

const nprogress = new NProgress({ parent: '.nprogress-container' })

const { state } = store

router.beforeEach((route, redirect, next) => {
  // Skipping fetching user if going to page that doesn't require authorization
  if (!route.meta.auth) {
    return next()
  }

  // If user if fetched, just redirect.
  if (state.login.user) return state.login.isLoggedIn ? next() : next('/login')

  // Fetching user if not fetched.
  return router.app.$auth.fetchUserWithExistingData().then(() => {
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
