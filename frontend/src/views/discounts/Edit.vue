<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveIntegration()">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="integration.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="integration.description"></textarea>
          </div>
          <label class="label">Preview</label>
          <div class="content">
            <span v-html="$options.filters.markdown(integration.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.message }}</p>
        </div>

        <div class="field">
          <label class="label">Сode</label>
          <div class="control">
            <input class="input" type="text" required v-model="integration.code" />
          </div>
          <p class="help is-danger" v-if="errors.code">{{ errors.code.join(', ')}}</p>
        </div>

        <div class="field has-addons">
          <p class="control">
            <input class="input" type="number"  v-model.number="integration.quota_amount" placeholder="Amount of codes claimable">
          </p>
          <p class="control">
            <a class="button is-statuc">
              /
            </a>
          </p>
          <p class="control">
            <span class="select">
              <select v-model="integration.quota_period">
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </span>
          </p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save integration" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditIntegration',
  data () {
    return {
      integration: {
        name: '',
        description: '',
        id: null,
        code: '',
        quota_period: 'month',
        quota_amount: 1
      },
      permissions: [],
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    saveIntegration () {
      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.services['discounts'] + '/integrations/' + this.$route.params.id, this.integration)
        : this.axios.post(this.services['discounts'] + '/integrations/', this.integration)

      promise.then(() => {
        this.isSaving = false

        this.$root.showSuccess('Integration is saved.')

        return this.$router.push({ name: 'oms.discounts.list' })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the integration data is invalid.')
        }

        this.$root.showError('Could not save integration', err)
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new integration
    }

    this.isLoading = true
    this.axios.get(this.services['discounts'] + '/integrations/' + this.$route.params.id).then((response) => {
      this.integration = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Integration is not found')
      } else {
        this.$root.showError('Some error happened', err.message)
      }

      this.$router.push({ name: 'oms.discounts.list' })
    })
  }
}
</script>
