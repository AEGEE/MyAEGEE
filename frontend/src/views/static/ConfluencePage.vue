<template>
  <div class="tile is-ancestor legal">
    <div class="tile is-parent is-vertical">
      <div class="tile is-child">
        <div class="title">{{ error ? 'The page is not found' : title }}</div>
        <div class="content" v-html="text" />

        <div class="notification is-danger" v-if="error">
          The page you've requested cannot be found. Maybe you've mistyped the URL?...
        </div>
      </div>
    </div>
  </div>
</template>

<script>
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
  mounted () {
    const id = this.namesMap[this.$route.params.page_id] || this.$route.params.page_id

    const pageUrl = '/services/jira-cors/wiki/rest/api/content/'
      + id
      + '?expand=body.export_view.webresource.tags.all'

    fetch(pageUrl)
      .then(data => data.json())
      .then(data => {
        this.title = data.title
        this.text = data.body.export_view.value
      }).catch(err => {
        console.log(err)
        this.error = true
      })
  }
}
</script>
