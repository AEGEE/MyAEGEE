<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Recruitment campaigns list</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
          </div>
        </div>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.campaigns.create' }">Create campaign</router-link>
          </div>
        </div>

        <b-table
          :data="campaigns"
          :loading="isLoading">
          <b-table-column field="id" label="#" numeric sortable v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="name" label="Campaign name" sortable v-slot="props">
            <router-link :to="{ name: 'oms.campaigns.view', params: { id: props.row.id } }">
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
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
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
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.campaigns = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/campaigns', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.campaigns = this.campaigns.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['core'] + '/my_permissions')
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
