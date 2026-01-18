import moment from 'moment'
import marked from 'marked'
import DOMPurify from 'dompurify'

export default {
  date (value) {
    return moment(value).format('YYYY-MM-DD')
  },
  datetime (value) {
    return moment(value).format('YYYY-MM-DD HH:mm')
  },
  datetimeseconds (value) {
    return moment(value).format('YYYY-MM-DD HH:mm:ss')
  },
  markdown (value) {
    return `<div class="markdown">${marked(DOMPurify.sanitize(value))}</div>`
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
