<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Recruitment campaigns list</h4>
        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.bodies.campaigns.new', params: { body_id: $route.params.id } }">Create campaign</router-link>
          </div>
        </div>

        <b-table :data="campaigns">
          <b-table-column field="name" label="Campaign name" v-slot="props">
            <router-link :to="{ name: 'oms.bodies.campaigns.view', params: { body_id: $route.params.id, id: props.row.id } }">
              {{ props.row.name }}
            </router-link>
          </b-table-column>

          <b-table-column field="description_long" label="Description" v-slot="props">
            <span class="description" v-html="$options.filters.markdown(props.row.description_long)" />
          </b-table-column>

          <b-table-column label="Link" v-slot="props">
            {{ '/signup/' + props.row.url }}
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more campaigns</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'CampaignsList',
  data () {
    return {
      campaigns: [],
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
    refetch () {
      this.campaigns = []
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/campaigns').then((response) => {
        this.campaigns = response.data.data

        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:campaign'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch campaign list', err)
        this.isLoading = false
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
