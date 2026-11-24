<template>
  <div class="tile is-ancestor legal">
    <div class="tile is-parent is-vertical">
      <div class="tile is-child">
        <h1 class="title">{{ error ? 'The page is not found' : title }}</h1>
        <div class="content" v-html="text" />

        <div class="notification is-danger" v-if="error">
          The page you've requested cannot be found. Maybe you've mistyped the URL?...
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DOMPurify from 'dompurify'

export default {
  name: 'ConfluencePage',
  data () {
    return {
      title: '',
      text: '',
      error: false,
      namesMap: {
        'myaegee-how-to': '240615425',
        'terms-of-service': '327057442',
        'mailing-lists': '962297917',
        'kms': '2288287780'
      }
    }
  },
  watch: {
    // The router reuses this component when only :page_id changes (for example going from
    // Legal info to KMS in the sidebar), so load the page on every change, not only on mount.
    '$route.params.page_id': {
      immediate: true,
      handler (pageId) {
        this.loadPage(pageId)
      }
    }
  },
  methods: {
    loadPage (pageId) {
      const id = this.namesMap[pageId] || pageId
      // Ignore responses for a page the user has already navigated away from.
      const request = Symbol(id)
      this.currentRequest = request

      this.title = ''
      this.text = ''
      this.error = false

      const pageUrl = '/services/jira-cors/wiki/rest/api/content/'
        + id
        + '?expand=body.export_view.webresource.tags.all'

      fetch(pageUrl)
        .then(data => data.json())
        .then(data => {
          if (this.currentRequest !== request) return
          this.title = data.title
          this.text = DOMPurify.sanitize(data.body.export_view.value)
        }).catch(err => {
          if (this.currentRequest !== request) return
          console.log(err)
          this.error = true
        })
    }
  }
}
</script>
