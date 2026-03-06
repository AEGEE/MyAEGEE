import Vuex from 'vuex'
import { createLocalVue, shallowMount } from '@vue/test-utils'
import filters from 'src/filters'

export function createAxiosMock ({ get = {}, post = {} } = {}) {
  return {
    get: jest.fn((url) => {
      const handler = get[url]
      if (!handler) {
        return Promise.reject(new Error(`Unexpected GET ${url}`))
      }

      return typeof handler === 'function' ? handler() : Promise.resolve(handler)
    }),
    post: jest.fn((url, body) => {
      const handler = post[url]
      if (!handler) {
        return Promise.reject(new Error(`Unexpected POST ${url}`))
      }

      return typeof handler === 'function' ? handler(body) : Promise.resolve(handler)
    })
  }
}

export function mountDiscountsView (component, options = {}) {
  const localVue = createLocalVue()
  localVue.use(Vuex)

  Object.keys(filters).forEach((key) => {
    localVue.filter(key, filters[key])
  })

  const store = new Vuex.Store({
    state: {
      services: options.services
    },
    getters: {
      services: (state) => state.services
    }
  })

  const showError = jest.fn()
  const showSuccess = jest.fn()

  const wrapper = shallowMount(component, {
    localVue,
    store,
    mocks: {
      axios: options.axios
    },
    parentComponent: {
      methods: {
        showError,
        showSuccess
      }
    },
    stubs: {
      'router-link': true,
      'font-awesome-icon': true,
      'b-table': {
        name: 'BTable',
        props: ['data'],
        template: '<div><slot /><slot name="empty" /></div>'
      },
      'b-table-column': {
        name: 'BTableColumn',
        template: '<div />'
      },
      'empty-table-stub': true,
      'b-icon': true
    }
  })

  return {
    wrapper,
    showError,
    showSuccess
  }
}
