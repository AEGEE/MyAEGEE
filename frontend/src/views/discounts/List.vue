<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Discounts integrations list</h4>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.discounts.create' }">Create integration</router-link>
          </div>
        </div>

        <b-table :data="integrations" :loading="isLoading" narrowed>
          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column field="code" label="Code" v-slot="props">
            {{ props.row.code }}
          </b-table-column>

          <b-table-column field="description" label="Description" v-slot="props">
            <span v-html="$options.filters.markdown(props.row.description)" />
          </b-table-column>

          <b-table-column label="Quota" v-slot="props">
            {{ props.row.quota_amount }}/{{ props.row.quota_period }}
          </b-table-column>

          <b-table-column label="Edit" v-slot="props">
            <router-link :to="{ name: 'oms.discounts.edit', params: { id: props.row.id } }" class="button is-small is-warning">Edit</router-link>
          </b-table-column>

          <b-table-column label="Add codes" v-slot="props">
            <router-link :to="{ name: 'oms.discounts.add_codes', params: { id: props.row.id } }" class="button is-small is-warning">Add codes</router-link>
          </b-table-column>

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
  name: 'IntegrationsList',
  data () {
    return {
      integrations: [],
      isLoading: false,
      permissions: [],
      can: {
        create: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (this.query) queryObj.query = this.query
      if (this.type) queryObj.filter = { type: this.type }
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.integrations = []
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['discounts'] + '/integrations').then((response) => {
        this.integrations = response.data.data

        return this.axios.get(this.services['core'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission => permission.combined.endsWith('manage:discounts'))
        this.isLoading = false
      }).catch((err) => {
        this.$root.showError('Could not fetch integrations list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
