import moment from 'moment'
import marked from 'marked'

export default {
  date (value) {
    return moment(value).format('YYYY-MM-DD')
  },
  datetime (value) {
    return moment(value).format('YYYY-MM-DD HH:mm')
  },
  markdown (value) {
    return marked(value, { sanitize: true })
  },
  capitalize (value) {
    if (typeof value !== 'string') return ''
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  },
  beautify (value) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value
  }
}
