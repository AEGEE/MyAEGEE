<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">My codes claimed</h4>

        <div class="field has-addons">
          <p class="control">
            <span class="select">
              <select v-model="selectedIntegration">
                <option v-for="integration in integrations" v-bind:key="integration.id" :value="integration.id">{{ integration.name }}</option>
              </select>
            </span>
          </p>
          <p class="control">
            <button class="button is-primary" @click="claimCode()">Claim code!</button>
          </p>

        </div>

        <b-table :data="codes" :loading="isLoading" narrowed>
          <template slot-scope="props">
            <b-table-column field="code" label="Code">
              {{ props.row.value }}
            </b-table-column>

             <b-table-column field="updated_at" label="Claimed on">
              {{ props.row.updated_at | datetimeseconds }}
            </b-table-column>

            <b-table-column field="name" label="Partner name">
              {{ props.row.integration.name }}
            </b-table-column>

            <b-table-column field="description" label="Description">
              <span v-html="$options.filters.markdown(props.row.integration.description)"></span>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MyDiscountsList',
  data () {
    return {
      codes: [],
      integrations: [],
      selectedIntegration: null,
      isLoading: false,
      permissions: [],
      can: {
        create: false
      }
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    claimCode () {
      if (!this.selectedIntegration) {
        return this.$root.showDanger('Please select a partner first.')
      }

      this.axios.post(this.services['oms-discounts'] + '/integrations/' + this.selectedIntegration  + '/claim').then((response) => {
        this.$root.showSuccess('Code is added.')

        // adding integration info
        const integration = this.integrations.find(int => int.id === this.selectedIntegration)
        response.data.data.integration = integration
        this.codes.unshift(response.data.data)
      }).catch((err) => {
        const msg = err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : err.message
        this.$root.showDanger('Could not claim code: ' + msg)
      })
    },
    refetch () {
      this.integrations = []
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true

      this.axios.get(this.services['oms-discounts'] + '/codes/mine').then((response) => {
        this.codes = response.data.data

        return this.axios.get(this.services['oms-discounts'] + '/integrations')
      }).then((response) => {
        this.integrations = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not fetch discounts: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
