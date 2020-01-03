import sluggify from './sluggify'

export default {
  showNotification (options) {
    options.duration = options.duration || 3000
    options.type = options.type || 'is-success'

    this.$buefy.toast.open(options)
  },
  showDanger (message) {
    this.showNotification({
      type: 'is-danger',
      message
    })
  },
  showWarning (message) {
    this.showNotification({
      type: 'is-warning',
      message
    })
  },
  showSuccess (message) {
    this.showNotification({
      type: 'is-success',
      message
    })
  },
  showInfo (message) {
    this.showNotification({
      type: 'is-info',
      message
    })
  },
  nullifyIfEmpty (object, key) {
    if (object[key] === '') {
      object[key] = null
    }
  },
  showError(message, error) {
    if (!error) {
      return this.showDanger(message)
    }

    // If error is Axios error and the body has 'message' field in response, return it.
    if (error.response && error.response.data && error.response.data.message) {
      return this.showDanger(`${message}: ${error.response.data.message}`)
    }

    // Otherwise, return error message.
    return this.showDanger(`${message}: ${error.message}`)
  },
  sluggify
}
