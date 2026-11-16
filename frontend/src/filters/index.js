import moment from 'moment'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Markdown never produces these. In raw HTML they could restyle or cover the page, or
// show a fake form (for example asking for a password), so they're removed as well.
const MARKDOWN_SANITIZE_OPTIONS = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['style']
}

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
    return `<div class="markdown">${DOMPurify.sanitize(marked.parse(value == null ? '' : String(value)), MARKDOWN_SANITIZE_OPTIONS)}</div>`
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
