/* eslint-env jest */

import Vuex from 'vuex'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import filters from 'src/filters'

function getHandler (handlers, url, method) {
  const handler = handlers[url]
  if (!handler) {
    return Promise.reject(new Error(`Unexpected ${method} ${url}`))
  }

  return handler
}

export function createAxiosMock ({ get = {}, post = {}, put = {}, del = {} } = {}) {
  return {
    get: jest.fn((url, config) => {
      const handler = get[url]
      if (!handler) {
        return Promise.reject(new Error(`Unexpected GET ${url}`))
      }

      return typeof handler === 'function' ? handler(config) : Promise.resolve(handler)
    }),
    post: jest.fn((url, body, config) => {
      const handler = post[url]
      if (!handler) {
        return Promise.reject(new Error(`Unexpected POST ${url}`))
      }

      return typeof handler === 'function' ? handler(body, config) : Promise.resolve(handler)
    }),
    put: jest.fn((url, body, config) => {
      const handler = getHandler(put, url, 'PUT')
      return typeof handler === 'function' ? handler(body, config) : Promise.resolve(handler)
    }),
    delete: jest.fn((url, config) => {
      const handler = getHandler(del, url, 'DELETE')
      return typeof handler === 'function' ? handler(config) : Promise.resolve(handler)
    })
  }
}

export function mountFrontendView (component, options = {}) {
  const localVue = createLocalVue()
  localVue.use(Vuex)

  Object.keys(filters).forEach((key) => {
    localVue.filter(key, filters[key])
  })

  const store = new Vuex.Store({
    state: {
      services: options.services,
      user: options.user || { bodies: [] }
    },
    getters: {
      services: (state) => state.services,
      user: (state) => state.user
    }
  })

  const showError = jest.fn()
  const showSuccess = jest.fn()
  const showInfo = jest.fn()
  const showWarning = jest.fn()

  const root = {
    showError,
    showSuccess,
    showInfo,
    showWarning,
    sluggify: jest.fn((value) => value),
    ...(options.root || {})
  }

  const wrapper = shallowMount(component, {
    localVue,
    store,
    mocks: {
      axios: options.axios,
      $route: options.route || { params: {} },
      $router: options.router || { push: jest.fn() },
      $buefy: options.buefy || { dialog: { confirm: jest.fn() } },
      accessToken: options.accessToken || 'test-token',
      $root: root,
      ...(options.mocks || {})
    },
    parentComponent: {
      methods: {
        showError,
        showSuccess,
        showInfo,
        showWarning
      }
    },
    stubs: {
      'router-link': true,
      'event-no-body-notification': true,
      'font-awesome-icon': true,
      'b-loading': true,
      'b-checkbox': true,
      'multiselect': true,
      'draggable': true,
      'mgl-map': true,
      'mgl-marker': true,
      'mgl-geolocate-control': true,
      'mgl-navigation-control': true,
      'mgl-fullscreen-control': true,
      'mgl-attribution-control': true,
      'mgl-scale-control': true,
      'mgl-geojson-layer': true,
      'b-field': true,
      'b-input': true,
      'b-select': true,
      'b-datepicker': true,
      'b-timepicker': true,
      'b-upload': true,
      'b-switch': true,
      'b-numberinput': true,
      'b-collapse': true,
      'b-button': true,
      'b-table': {
        name: 'BTable',
        props: ['data'],
        template: '<div><slot /><slot name="empty" /></div>'
      },
      'b-table-column': {
        name: 'BTableColumn',
        template: '<div />'
      },
      'b-icon': true,
      'b-tooltip': true,
      'b-message': true,
      'b-radio': true,
      'b-tag': true,
      'b-taginput': true,
      'b-autocomplete': true,
      'b-tabs': true,
      'b-tab-item': true,
      'b-notification': true,
      'b-dropdown': true,
      'b-dropdown-item': true,
      'v-jsoneditor': true,
      'empty-table': true,
      'empty-table-stub': true,
      'flat-pickr': true,
      ...(options.stubs || {})
    }
  })

  return {
    wrapper,
    showError,
    showSuccess,
    showInfo,
    showWarning
  }
}
