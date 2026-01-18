import nprogress from 'nprogress'

const defaults = {
  latencyThreshold: 100,
  router: true,
  http: true
}

function install (Vue, options = {}) {
  if (this.installed) return
  this.installed = true

  Object.defineProperty(Vue.prototype, '$nprogress', {
    get: function get () {
      return this.$root._nprogress
    }
  })

  options = { ...defaults, ...options }

  Vue.mixin({
    beforeCreate () {
      const np = this.$options.nprogress

      if (!np) {
        return
      }

      let requestsTotal = 0
      let requestsCompleted = 0
      const { latencyThreshold, router: applyOnRouter, http: applyOnHttp } = options
      let confirmed = true

      function setComplete () {
        requestsTotal = 0
        requestsCompleted = 0
        np.done()
      }

      function initProgress () {
        if (requestsTotal === 0) {
          setTimeout(() => np.start(), latencyThreshold)
        }
        requestsTotal++
        np.set(requestsCompleted / requestsTotal)
      }

      function increase () {
        // Finish progress bar 50 ms later
        setTimeout(() => {
          ++requestsCompleted
          if (requestsCompleted >= requestsTotal) {
            setComplete()
          } else {
            np.set((requestsCompleted / requestsTotal) - 0.1)
          }
        }, latencyThreshold + 50)
      }

      this._nprogress = np
      np.init(this)

      if (applyOnHttp) {
        const http = Vue.http
        const axios = Vue.axios

        if (http) {
          http.interceptors.push((request, next) => {
            const showProgressBar = 'showProgressBar' in request ? request.showProgressBar : applyOnHttp
            if (showProgressBar) initProgress()

            next(response => {
              if (!showProgressBar) return response
              increase()
            })
          })
        } else if (axios) {
          axios.interceptors.request.use((request) => {
            if (!('showProgressBar' in request)) request.showProgressBar = applyOnHttp
            if (request.showProgressBar) initProgress()
            return request
          }, (error) => Promise.reject(error))

          axios.interceptors.response.use((response) => {
            if (response.config.showProgressBar) increase()
            return response
          }, (error) => {
            if ((error.config && error.config.showProgressBar) || axios.isCancel(error)) increase()
            return Promise.reject(error)
          })
        }
      }

      const router = applyOnRouter && this.$options.router
      if (router) {
        router.beforeEach((route, from, next) => {
          const showProgressBar = 'showProgressBar' in route.meta ? route.meta.showProgressBar : applyOnRouter
          if (showProgressBar && confirmed) {
            initProgress()
            confirmed = false
          }
          next()
        })
        router.afterEach(route => {
          const showProgressBar = 'showProgressBar' in route.meta ? route.meta.showProgressBar : applyOnRouter
          if (showProgressBar) {
            increase()
            confirmed = true
          }
        })
      }
    }
  })
}

function NProgress (options) {
  this.app = null
  this.configure(options || {})
}

NProgress.install = install

NProgress.start = function () {

}

Object.assign(NProgress.prototype, nprogress, {
  init (app) {
    this.app = app
  }
})

export default NProgress
