<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <h1 id="resource-link-title-heading" class="title">{{ $route.params.id ? 'Edit link' : 'Add link' }}</h1>

      <form aria-labelledby="resource-link-title-heading" :aria-busy="isLoading" @submit.prevent="save()">
        <div class="field">
          <label class="label" for="resource-link-category">Section</label>
          <div class="control">
            <div class="select">
              <select
                id="resource-link-category"
                required
                :aria-describedby="errors.category_id ? 'resource-link-category-help resource-link-category-error' : 'resource-link-category-help'"
                v-model="link.category_id"
              >
                <option v-for="section in sections" :key="section.id" :value="section.id">{{ section.name }}</option>
              </select>
            </div>
          </div>
          <p id="resource-link-category-help" class="help">A link moved to another section goes to the end of that section.</p>
          <p id="resource-link-category-error" class="help is-danger" v-if="errors.category_id">{{ errors.category_id.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="resource-link-title">Title</label>
          <div class="control">
            <input id="resource-link-title" class="input" type="text" required maxlength="100" :aria-describedby="errors.title ? 'resource-link-title-error' : null" v-model="link.title" />
          </div>
          <p id="resource-link-title-error" class="help is-danger" v-if="errors.title">{{ errors.title.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="resource-link-description">Description</label>
          <div class="control">
            <input
              id="resource-link-description"
              class="input"
              type="text"
              required
              maxlength="255"
              :aria-describedby="errors.description ? 'resource-link-description-error' : null"
              v-model="link.description"
            />
          </div>
          <p id="resource-link-description-error" class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="resource-link-url">URL</label>
          <div class="control">
            <input
              id="resource-link-url"
              class="input"
              type="text"
              required
              maxlength="2048"
              placeholder="https://www.aegee.org/ or /pages/mailing-lists"
              :aria-describedby="errors.url ? 'resource-link-url-help resource-link-url-error' : 'resource-link-url-help'"
              v-model="link.url"
            />
          </div>
          <p id="resource-link-url-help" class="help">
            An address starting with https:// opens in a new tab. A MyAEGEE page is a path starting with /, like /pages/mailing-lists, and opens in the same tab.
          </p>
          <p id="resource-link-url-error" class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <b-loading :is-full-page="false" :active="isLoading" />

        <div class="buttons">
          <input type="submit" value="Save link" :disabled="isSaving" class="button is-primary" />
          <router-link class="button" :to="{ name: 'oms.resources.manage' }">Cancel</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditResourceLink',
  data () {
    return {
      link: {
        category_id: this.$route.query.category_id ? Number(this.$route.query.category_id) : null,
        title: '',
        description: '',
        url: ''
      },
      sections: [],
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    save () {
      this.isSaving = true
      this.errors = {}

      const body = {
        category_id: this.link.category_id,
        title: this.link.title,
        description: this.link.description,
        url: this.link.url
      }
      const promise = this.$route.params.id
        ? this.axios.put(this.services['core'] + '/resources/links/' + this.$route.params.id, body)
        : this.axios.post(this.services['core'] + '/resources/links', body)

      promise.then(() => {
        this.$root.showSuccess('Link is saved.')
        return this.$router.push({ name: 'oms.resources.manage' })
      }).catch((err) => {
        if (err.response && err.response.status === 422 && err.response.data.errors) {
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the link data is invalid.')
        }

        this.$root.showError('Could not save the link', err)
      }).finally(() => {
        this.isSaving = false
      })
    }
  },
  mounted () {
    this.isLoading = true

    const requests = [this.axios.get(this.services['core'] + '/resources')]
    if (this.$route.params.id) {
      requests.push(this.axios.get(this.services['core'] + '/resources/links/' + this.$route.params.id))
    }

    Promise.all(requests).then(([sectionsResponse, linkResponse]) => {
      this.sections = sectionsResponse.data.data
      if (linkResponse) {
        this.link = linkResponse.data.data
      }
    }).catch((err) => {
      this.$root.showError('Could not load the link', err)
      this.$router.push({ name: 'oms.resources.manage' })
    }).finally(() => {
      this.isLoading = false
    })
  }
}
</script>

<style lang="scss" scoped>
form {
  position: relative; // for the loading overlay
}
</style>
