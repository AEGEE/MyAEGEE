import sluggify from './sluggify'
import escapeHtml from './escape-html'

export default {
  showNotification (options) {
    // Buefy renders toast messages as HTML. None of ours need markup, and they often
    // contain names or server messages, so they're always shown as plain text.
    // Long enough to read: three seconds for a short message, more for a long one (an error
    // that lists several validation messages), up to ten seconds. Measured on the text as
    // written, before escaping.
    options.duration = options.duration || Math.min(10000, Math.max(3000, 1000 + String(options.message).length * 60))
    options.message = escapeHtml(options.message)
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

    const data = error.response && error.response.data

    // If error is Axios error and the body has 'message' field in response, return it.
    if (data && data.message) {
      return this.showDanger(`${message}: ${data.message}`)
    }

    // Validation errors come as messages per field: { errors: { name: ['Name should be set.'] } }.
    if (data && data.errors) {
      const errors = typeof data.errors === 'string' ? data.errors : Object.values(data.errors).flat().join('; ')
      if (errors) {
        return this.showDanger(`${message}: ${errors}`)
      }
    }

    // Otherwise, return error message.
    return this.showDanger(`${message}: ${error.message}`)
  },
  sluggify,
  escapeHtml
}
