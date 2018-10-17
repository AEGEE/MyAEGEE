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
  }
}
