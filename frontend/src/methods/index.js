import sluggify from './sluggify'
import escapeHtml from './escape-html'

export default {
  showNotification (options) {
    // Buefy renders toast messages as HTML. None of ours need markup, and they often
    // contain names or server messages, so they're always shown as plain text.
    options.message = escapeHtml(options.message)
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
  showError (message, error) {
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
  sluggify,
  escapeHtml
}
