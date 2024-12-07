<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <p class="subtitle">Campaign submissions</p>

      <div class="field">
        <label class="label">Search by name or surname</label>
        <div class="field has-addons">
          <div class="control is-expanded">
            <input class="input" type="text" v-model="query" placeholder="Search by name or surname" @input="refetch()" />
          </div>
        </div>
      </div>

      <b-table
        :data="members"
        paginated
        :per-page="limit"
        default-sort="id"
        default-sort-direction="desc">
        <b-table-column field="id" label="#" numeric sortable v-slot="props">
          {{ props.row.id }}
        </b-table-column>

        <b-table-column field="first_name" label="User" sortable v-slot="props">
          <router-link :to="{ name: 'oms.members.view', params: { id: props.row.url || props.row.id } }">
            {{ props.row.first_name }} {{ props.row.last_name }}
          </router-link>
        </b-table-column>

        <b-table-column field="mail_confirmed" label="Email confirmed?" sortable v-slot="props">
          <span class="tag is-small" :class="(props.row.mail_confirmed_at) ? 'is-primary' : 'is-danger'">
            {{ !!props.row.mail_confirmed_at | beautify }}
          </span>
        </b-table-column>

        <template slot="empty">
          <empty-table-stub />
        </template>
      </b-table>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'CampaignMembersList',
  data () {
    return {
      members: [],
      campaign: {},
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null
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
      this.members = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchMembers()
    },
    async fetchMembers () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      try {
        const response = await this.axios.get(this.services['core'] + '/campaigns/' + this.$route.params.id + '/members', {
          params: this.queryObject,
          cancelToken: this.source.token
        })

        this.members = this.members.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      } catch (err) {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch campaign members', err)
        this.isLoading = false
      }
    },
    async fetchCampaign () {
      this.isLoading = true
      try {
        const campaignUrl = this.$route.params.body_id
          ? this.services['core'] + '/bodies/' + this.$route.params.body_id + '/campaigns/' + this.$route.params.id
          : this.services['core'] + '/campaigns/' + this.$route.params.id

        const campaignsResponse = await this.axios.get(campaignUrl)
        this.campaign = campaignsResponse.data.data

        this.isLoading = false
      } catch (err) {
        this.$root.showError('Could not fetch campaign', err)
        this.isLoading = false
      }
    }
  },
  mounted () {
    this.fetchCampaign().then(() => this.fetchMembers())
  }
}
</script>
