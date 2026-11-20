import moment from 'moment'
import { marked } from 'marked'
import sanitizeHtml from '../methods/sanitize-html'
import safeUrl from '../methods/safe-url'

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
    // Sanitize the rendered HTML, not the markdown source: marked turns
    // `[x](javascript:...)` into a live link that DOMPurify never sees otherwise.
    return `<div class="markdown">${sanitizeHtml(marked.parse(value == null ? '' : String(value)))}</div>`
  },
  capitalize (value) {
    if (typeof value !== 'string') return ''
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  },
  safeUrl (value) {
    // For :href bindings; null leaves the href out, so unsafe links can't be clicked.
    return safeUrl(value)
  },
  beautify (value) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value
  }
}
