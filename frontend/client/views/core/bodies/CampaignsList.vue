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
          <template slot-scope="props">
            <b-table-column field="name" label="Campaign name">
              <router-link :to="{ name: 'oms.bodies.campaigns.view', params: { body_id: $route.params.id, id: props.row.id } }">
                {{ props.row.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="description" label="Description">
              {{ props.row.description_short }}
            </b-table-column>

            <b-table-column label="Link">
              {{ '/signup/' + props.row.url }}
            </b-table-column>
          </template>

          <template slot="empty">
            <section class="section">
              <div class="content has-text-grey has-text-centered">
                <p>
                  <b-icon icon="fa fa-times-circle" size="is-large"></b-icon>
                </p>
                <p>Nothing here.</p>
              </div>
            </section>
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
    fetchData (state) {
      this.isLoading = true

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/campaigns').then((response) => {
        this.campaigns = response.data.data

        return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:campaign'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch campaign list: ')
        this.isLoading = false
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
