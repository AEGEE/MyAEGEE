<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <h1 id="resource-category-title" class="title">{{ $route.params.id ? 'Edit section' : 'Add section' }}</h1>

      <form aria-labelledby="resource-category-title" :aria-busy="isLoading" @submit.prevent="save()">
        <div class="field">
          <label class="label" for="resource-category-name">Name</label>
          <div class="control">
            <input
              id="resource-category-name"
              class="input"
              type="text"
              required
              maxlength="100"
              :aria-describedby="errors.name ? 'resource-category-name-error' : null"
              v-model="category.name"
            />
          </div>
          <p id="resource-category-name-error" class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <fieldset class="field" :aria-describedby="errors.theme ? 'resource-category-theme-error' : null">
          <legend class="label">Colour</legend>
          <div class="theme-options">
            <label v-for="theme in themes" :key="theme.key" class="theme-option">
              <input type="radio" name="theme" :value="theme.key" required v-model="category.theme" />
              <span class="theme-option-swatch" :style="{ background: theme.background, color: theme.color }">{{ theme.label }}</span>
            </label>
          </div>
          <p id="resource-category-theme-error" class="help is-danger" v-if="errors.theme">{{ errors.theme.join(', ') }}</p>
        </fieldset>

        <b-loading :is-full-page="false" :active="isLoading" />

        <div class="buttons">
          <input type="submit" value="Save section" :disabled="isSaving" class="button is-primary" />
          <router-link class="button" :to="{ name: 'oms.resources.manage' }">Cancel</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { THEMES } from './helpers'

export default {
  name: 'EditResourceCategory',
  data () {
    return {
      category: {
        name: '',
        theme: 'blue'
      },
      themes: THEMES,
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

      const body = { name: this.category.name, theme: this.category.theme }
      const promise = this.$route.params.id
        ? this.axios.put(this.services['core'] + '/resources/categories/' + this.$route.params.id, body)
        : this.axios.post(this.services['core'] + '/resources/categories', body)

      promise.then(() => {
        this.$root.showSuccess('Section is saved.')
        return this.$router.push({ name: 'oms.resources.manage' })
      }).catch((err) => {
        if (err.response && err.response.status === 422 && err.response.data.errors) {
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the section data is invalid.')
        }

        this.$root.showError('Could not save the section', err)
      }).finally(() => {
        this.isSaving = false
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true
    this.axios.get(this.services['core'] + '/resources/categories/' + this.$route.params.id).then((response) => {
      this.category = response.data.data
    }).catch((err) => {
      this.$root.showError('Could not load the section', err)
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

.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.theme-option-swatch {
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 700;
}
</style>
