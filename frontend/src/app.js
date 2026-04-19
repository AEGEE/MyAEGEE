/* eslint no-use-before-define: 0 */

import Vue from 'vue'
import axios from 'axios'
import VueAxios from 'vue-axios'
import { sync } from 'vuex-router-sync'
import {
  Autocomplete,
  Button,
  Checkbox,
  Collapse,
  ConfigProgrammatic,
  Datepicker,
  Dialog,
  Field,
  Icon,
  Input,
  Loading,
  Message,
  Modal,
  Radio,
  Select,
  Switch,
  Table,
  Tag,
  Toast
} from 'buefy'
import qs from 'qs'
import Vue2TouchEvents from 'vue2-touch-events'
import VTooltip from 'v-tooltip'

import App from './App.vue'
import FontAwesomeIcon from './fontawesome'
import NProgress from './scripts/vue-nprogress'
import router from './router'
import store from './store'
import filters from './filters'
import Auth from './auth'
import SelectOrCustom from './components/SelectOrCustom'
import PasswordToggle from './components/PasswordToggle'
import EmptyTableStub from './components/EmptyTableStub'
import Tooltip from './components/Tooltip'

axios.defaults.paramsSerializer = params => qs.stringify(params, {
  arrayFormat: 'brackets',
  encode: false,
  encodeValuesOnly: true
})

Vue.router = router
Vue.use(VueAxios, axios)
Vue.use(Auth)
Vue.use(NProgress)
ConfigProgrammatic.setOptions({ defaultNoticeQueue: false, defaultIconPack: 'fa' })
Vue.use(Autocomplete)
Vue.use(Button)
Vue.use(Checkbox)
Vue.use(Collapse)
Vue.use(Datepicker)
Vue.use(Dialog)
Vue.use(Field)
Vue.use(Icon)
Vue.use(Input)
Vue.use(Loading)
Vue.use(Message)
Vue.use(Modal)
Vue.use(Radio)
Vue.use(Select)
Vue.use(Switch)
Vue.use(Table)
Vue.use(Tag)
Vue.use(Toast)
Vue.use(Vue2TouchEvents)
Vue.use(VTooltip)
Vue.component('select-or-custom', SelectOrCustom)
Vue.component('password-toggle', PasswordToggle)
Vue.component('empty-table-stub', EmptyTableStub)
Vue.component('font-awesome-icon', FontAwesomeIcon)
Vue.component('tooltip', Tooltip)

// Enable devtools
Vue.config.devtools = true
Vue.config.performance = true

sync(store, router)

const nprogress = new NProgress({ parent: '.nprogress-container' })

const { state } = store

router.beforeEach((to, from, next) => {
  const prefix = to.name === 'oms.login' ? '' : '?to=' + encodeURI(to.fullPath)
  const loggedInRedirectPath = to.query.to ? decodeURI(to.query.to) : '/dashboard'

  // Fuck my life.
  if (state.login.user) {
    if (to.name === 'oms.login') {
      console.debug('User is already logged in, redirecting away from /login.')
      return next(loggedInRedirectPath)
    }

    if (!state.login.isValid && to.meta.auth && to.name !== 'oms.profile.update') {
      console.debug('User is invalid (user fetched):', state.login.validationErrors)
      console.debug('Path', from.path, to.path)
      return next('/profile/update')
    }

    // First, checking if the user is fetched, if so, not fetching it again.
    // For auth-only requests we'll catch it later in .catch() block
    console.debug('User is fetched, skipping.')
    document.title = 'MyAEGEE | ' + to.meta.label
    return next()
  }

  if (!from.name) {
    console.debug('First time loading page, need to fetch user in any way.')
  } else if (to.name === 'oms.login') {
    console.debug('Going to /login anyway, no need to fetch user.')
    return next()
  } else if (from.name === 'oms.login') {
    console.debug('Going from /login, need to fetch user.')
  } else if (to.meta.auth) {
    console.debug('Going to auth only page without user fetched, need to fetch user.')
  } else {
    console.debug('Going to page with unauthorized access, no need to fetch anything.')
    return next()
  }

  // Fetching user if not fetched.
  return router.app.$auth.fetchUserWithExistingData().then(() => {
    if (state.login.isLoggedIn && to.name === 'oms.login') {
      console.debug('User is already logged in after auth check, redirecting away from /login.')
      return next(loggedInRedirectPath)
    }

    if (!state.login.isLoggedIn && to.meta.auth) {
      throw new Error('Trying to access the auth-only page while being unauthorized.')
    }

    if (!state.login.isValid && to.meta.auth) {
      console.debug('User is invalid (user not fetched):', state.login.validationErrors)
      return next('/profile/update')
    }

    document.title = 'MyAEGEE | ' + to.meta.label
    return next()
  }).catch((err) => {
    // Allow unauthorized users to access if allowed.
    if (!to.meta.auth) {
      console.debug('The endpoint is allowed by unauthorized user, not redirecting.')
      return next()
    }

    console.debug('Error fetching user, redirect to /login. Error: ' + err)
    return next('/login' + prefix)
  })
})

axios.interceptors.request.use(config => {
  const token = window.localStorage.getItem('access-token')
  config.headers['X-Auth-Token'] = token
  return config
})

let renewalPromise = null

axios.interceptors.response.use(
  response => response, // success handler
  error => {
    const originalRequest = error.config
    if (axios.isCancel(error) || !error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    console.debug('Token expired, renewing...')
    originalRequest._retry = true

    const refreshToken = window.localStorage.getItem('refresh-token')
    if (!refreshToken) {
      console.debug('No refresh token provided')

      // Workaround indicating that we don't need to redirect (it's an auth request)
      if (!originalRequest.headers['X-For-Auth']) {
        const prefix = app.$route.name === 'oms.login' ? '' : '?to=' + encodeURI(app.$route.fullPath)
        router.push('/login' + prefix)
      }
      return Promise.reject(error)
    }

    if (!renewalPromise) {
      renewalPromise = Vue.axios.post(state.services['core'] + '/renew', { refresh_token: refreshToken })
        .then((result) => {
          console.debug('Renew access token successfully.')
          window.localStorage.setItem('access-token', result.data.access_token)
          if (result.data.refresh_token) {
            window.localStorage.setItem('refresh-token', result.data.refresh_token)
          }
          return result.data.access_token
        })
        .catch((renewError) => {
          console.debug('Token renewal failed:', renewError)
          window.localStorage.removeItem('access-token')
          window.localStorage.removeItem('refresh-token')
          if (!originalRequest.headers['X-For-Auth']) {
            const prefix = app.$route.name === 'oms.login' ? '' : '?to=' + encodeURI(app.$route.fullPath)
            router.push('/login' + prefix)
          }
          throw renewError
        })
        .finally(() => { renewalPromise = null })
    }

    return renewalPromise.then((newToken) => {
      originalRequest.headers['X-Auth-Token'] = newToken
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
