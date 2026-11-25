<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child" aria-labelledby="discount-integrations-title" :aria-busy="isLoading">
        <h1 class="title" id="discount-integrations-title">Discounts integrations list</h1>

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
            <router-link :to="{ name: 'oms.discounts.edit', params: { id: props.row.id } }" class="button is-small is-warning" :aria-label="'Edit integration ' + props.row.name">Edit</router-link>
          </b-table-column>

          <b-table-column label="Add codes" v-slot="props">
            <router-link :to="{ name: 'oms.discounts.add_codes', params: { id: props.row.id } }" class="button is-small is-warning" :aria-label="'Add codes to ' + props.row.name">Add codes</router-link>
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
      isLoading: false
    }
  },
  computed: {
    // The same check as the discounts service's: a permission that ends in manage:discounts.
    can () {
      return {
        create: this.permissions.some(permission => permission.combined.endsWith('manage:discounts'))
      }
    },
    ...mapGetters(['services', 'permissions'])
  },
  methods: {
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['discounts'] + '/integrations').then((response) => {
        this.integrations = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch integrations list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
