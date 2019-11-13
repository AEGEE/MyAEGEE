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
  sluggify
}
