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

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Campaign name</th>
                <th>Description</th>
                <th>Link</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Campaign name</th>
                <th>Description</th>
                <th>Link</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="campaigns.length" v-for="campaign in campaigns" v-bind:key="campaign.id">
                <td>
                  <router-link :to="{ name: 'oms.bodies.campaigns.view', params: { body_id: $route.params.id, id: campaign.id } }">
                    {{ campaign.name }}
                  </router-link>
                </td>
                <td>{{ campaign.description }}</td>
                <td>{{ '/signup/' + campaign.url }}</td>
              </tr>
              <tr v-show="!campaigns.length && !isLoading">
                <td colspan="4" class="has-text-centered">Campaigns list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="4" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              :class="{ 'is-loading': isLoading }"
              :disabled="isLoading"
              v-show="canLoadMore"
              @click="fetchData()">Load more campaigns</button>
          </div>
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

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id).then((response) => {
        this.campaigns = response.data.data.campaigns

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
