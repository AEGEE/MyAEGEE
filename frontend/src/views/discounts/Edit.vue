<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <h1 class="title" id="integration-edit-title">{{ $route.params.id ? 'Edit integration' : 'Create integration' }}</h1>

      <form class="is-relative" @submit.prevent="saveIntegration()" aria-labelledby="integration-edit-title" :aria-busy="isLoading">
        <div class="field">
          <label class="label" for="integration-name">Name</label>
          <div class="control">
            <input class="input" id="integration-name" type="text" required v-model="integration.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="integration-description">Description</label>
          <div class="control">
            <textarea class="textarea" id="integration-description" placeholder="e.g. Hello world" required v-model="integration.description" />
          </div>
          <p class="label"><span id="integration-preview">Preview</span> <MarkdownTooltip /></p>
          <div class="content" role="region" aria-labelledby="integration-preview">
            <span v-html="$options.filters.markdown(integration.description)" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="integration-code">Code</label>
          <div class="control">
            <input class="input" id="integration-code" type="text" required v-model="integration.code" />
          </div>
          <p class="help is-danger" v-if="errors.code">{{ errors.code.join(', ')}}</p>
        </div>

        <label class="label" for="integration-quota-amount">Codes per period</label>
        <div class="field has-addons">
          <p class="control">
            <input class="input" id="integration-quota-amount" type="number" v-model.number="integration.quota_amount" placeholder="Amount of codes claimable">
          </p>
          <p class="control">
            <span class="button is-static" aria-hidden="true">
              /
            </span>
          </p>
          <p class="control">
            <span class="select">
              <select v-model="integration.quota_period" aria-label="Period">
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </span>
          </p>
        </div>
        <p class="help is-danger" v-if="errors.quota_amount">{{ errors.quota_amount.join(', ') }}</p>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save integration" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MarkdownTooltip
  },
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

        if (err.response && err.response.status === 422) { // validation errors
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
      if (err.response && err.response.status === 404) {
        this.$root.showError('Integration is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.discounts.list' })
    })
  }
}
</script>
