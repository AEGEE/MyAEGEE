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
import '@fontsource/open-sans/300.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'

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
import { afterLogin } from './methods/navigation'

axios.defaults.paramsSerializer = params => qs.stringify(params, {
  arrayFormat: 'brackets',
  encode: false,
  encodeValuesOnly: true
})

Vue.router = router
Vue.use(VueAxios, axios)
Vue.use(Auth)
Vue.use(NProgress)
// Every icon Buefy needs must be registered in ./fontawesome.js.
ConfigProgrammatic.setOptions({
  defaultNoticeQueue: false,
  defaultIconPack: 'fas',
  defaultIconComponent: 'font-awesome-icon'
})
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
// Buefy has no global default for the role of the dialogs and modals opened from code, so
// they all get it here. Call sites only add what names them: `title` for dialogs, `ariaLabel`
// for modals.
const withDefaults = (programmatic, method, defaults, afterOpen) => {
  const original = programmatic[method]
  programmatic[method] = params => {
    const opened = original.call(programmatic, { ...defaults, ...params })
    if (afterOpen) afterOpen(opened)
    return opened
  }
}

// Buefy's dialog renders `role` and `aria-modal`, but nothing that names it: its title is a
// paragraph the dialog doesn't refer to. So once a dialog is in the page, it is labelled by
// its title and described by its message; a dialog without a title is labelled by its message.
let dialogCount = 0
const nameDialog = (dialog) => {
  dialog.$nextTick(() => {
    const root = dialog.$el
    const id = `dialog-${++dialogCount}`
    const title = root.querySelector('.modal-card-title')
    const message = root.querySelector('.media-content > p')
    if (title) title.id = `${id}-title`
    if (message) message.id = `${id}-message`
    if (title) {
      root.setAttribute('aria-labelledby', title.id)
      if (message) root.setAttribute('aria-describedby', message.id)
    } else if (message) {
      root.setAttribute('aria-labelledby', message.id)
    }
  })
}

for (const method of ['alert', 'confirm', 'prompt']) {
  withDefaults(Vue.prototype.$buefy.dialog, method, { ariaRole: 'alertdialog', ariaModal: true }, nameDialog)
}
withDefaults(Vue.prototype.$buefy.modal, 'open', { ariaRole: 'dialog', ariaModal: true })
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

// The login page, with the page to go on to after logging in. vue-router encodes the target,
// so its own query string and hash survive the round trip.
const loginFor = (route) => ({ path: '/login', query: { to: route.fullPath } })

router.beforeEach((to, from, next) => {
  const loggedInRedirectPath = afterLogin(to.query)

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

    if (!state.login.isValid && to.meta.auth) {
      console.debug('User is invalid (user not fetched):', state.login.validationErrors)
      return next('/profile/update')
    }

    return next()
  }).catch((err) => {
    // Allow unauthorized users to access if allowed.
    if (!to.meta.auth) {
      console.debug('The endpoint is allowed by unauthorized user, not redirecting.')
      return next()
    }

    console.debug('Error fetching user, redirect to /login. Error: ' + err)
    return next(loginFor(to))
  })
})

// Every page names itself in the window title, for members and visitors alike.
router.afterEach((to) => {
  document.title = 'MyAEGEE | ' + to.meta.label
})

axios.interceptors.request.use(config => {
  const token = window.localStorage.getItem('access-token')
  config.headers['X-Auth-Token'] = token
  return config
})

let renewalPromise = null

// The session is over: there is no refresh token, or core refused to renew it. The member is
// forgotten, so the login page doesn't send them straight back as someone still logged in.
// Returns whether the app leaves the page for the login page: not for the guard's own request
// (`X-For-Auth`), which decides itself where to go, and not on the login page, where there is
// nowhere else to go.
const endSession = (request) => {
  store.dispatch('logout')
  if (request.headers['X-For-Auth'] || app.$route.name === 'oms.login') {
    return false
  }
  router.push(loginFor(app.$route))
  return true
}

// What a request whose session ended gives the page that sent it. A page that is being left
// for the login page gets no answer at all: its own error handling would only show an error
// over the login page, or navigate away from it.
const sessionEnded = (request, error, leftPage) => {
  if (leftPage && !request.headers['X-For-Auth']) {
    return new Promise(() => {})
  }
  return Promise.reject(error)
}

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
      return sessionEnded(originalRequest, error, endSession(originalRequest))
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
          renewError.leftPage = endSession(originalRequest)
          throw renewError
        })
        .finally(() => { renewalPromise = null })
    }

    return renewalPromise.then((newToken) => {
      originalRequest.headers['X-Auth-Token'] = newToken
      return axios(originalRequest)
    }, (renewError) => sessionEnded(originalRequest, renewError, renewError.leftPage))
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
