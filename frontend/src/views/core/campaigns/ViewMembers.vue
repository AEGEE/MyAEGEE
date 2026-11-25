<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <h1 class="title" v-if="campaign.name">{{ campaign.name }}</h1>
      <h2 class="subtitle">Campaign submissions</h2>

      <div class="field">
        <label class="label" for="campaign-members-search">Search by name or surname</label>
        <div class="field has-addons">
          <div class="control is-expanded">
            <input id="campaign-members-search" class="input" type="text" v-model="query" placeholder="Search by name or surname" @input="refetch()" />
          </div>
        </div>
      </div>

      <b-table
        :data="members"
        ariaNextLabel="Next page"
        ariaPreviousLabel="Previous page"
        ariaPageLabel="Page"
        ariaCurrentLabel="Current page"
        paginated
        backend-pagination
        backend-sorting
        :total="total"
        :per-page="limit"
        :current-page.sync="page"
        @page-change="onPageChange"
        :default-sort="[sortField, sortOrder]"
        @sort="onSort">
        <b-table-column field="id" label="#" numeric sortable v-slot="props">
          {{ props.row.id }}
        </b-table-column>

        <b-table-column field="first_name" label="User" sortable v-slot="props">
          <router-link :to="{ name: 'oms.members.view', params: { id: props.row.id } }">
            {{ props.row.first_name }} {{ props.row.last_name }}
          </router-link>
        </b-table-column>

        <b-table-column field="mail_confirmed_at" label="Email confirmed?" sortable v-slot="props">
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
      // The page of the pager, from 1.
      page: 1,
      total: 0,
      sortField: 'id',
      sortOrder: 'desc',
      source: null
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: (this.page - 1) * this.limit,
        sort: this.sortField,
        direction: this.sortOrder
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    },
    // A campaign of a body, and who signed up through it, are asked for through that body.
    campaignUrl () {
      return this.$route.params.body_id
        ? this.services['core'] + '/bodies/' + this.$route.params.body_id + '/campaigns/' + this.$route.params.id
        : this.services['core'] + '/campaigns/' + this.$route.params.id
    },
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.members = []
      this.page = 1
      this.total = 0
      this.fetchMembers()
    },
    onPageChange (page) {
      this.page = page
      this.fetchMembers()
    },
    onSort (field, order) {
      this.sortField = field
      this.sortOrder = order
      this.page = 1
      this.fetchMembers()
    },
    async fetchMembers () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      try {
        const response = await this.axios.get(this.campaignUrl + '/members', {
          params: this.queryObject,
          cancelToken: this.source.token
        })

        this.members = response.data.data
        this.total = response.data.meta.count
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
        const campaignsResponse = await this.axios.get(this.campaignUrl)
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
