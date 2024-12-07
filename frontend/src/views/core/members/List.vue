<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">User list</h4>
        <div class="field">
          <label class="label">Search by name or surname</label>
          <div class="control">
            <input class="input" type="text" data-cy="query" v-model="query" placeholder="Search by name or surname" @input="refetch()">
          </div>
        </div>

        <b-table
          :data="users"
          :loading="isLoading"
          paginated
          backend-pagination
          backend-sorting
          :total="total"
          :per-page="limit"
          @page-change="onPageChange"
          :default-sort="[sortField, sortOrder]"
          @sort="onSort">
          <b-table-column field="id" label="#" numeric sortable v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="first_name" label="Name and surname" sortable width="150" v-slot="props">
            <router-link :to="{ name: 'oms.members.view', params: { id: props.row.username || props.row.id } }">
              {{ props.row.first_name }} {{ props.row.last_name }}
            </router-link>
          </b-table-column>

          <b-table-column field="email" label="Notification email" v-slot="props">
            {{ props.row.notification_email }}
          </b-table-column>

          <b-table-column field="date_of_birth" label="Birthday" sortable width="150" v-slot="props">
            {{ props.row.date_of_birth }}
          </b-table-column>

          <b-table-column field="address" label="Address" v-slot="props">
            {{ props.row.address }}
          </b-table-column>

          <b-table-column field="about_me" label="About me" v-slot="props">
            {{ props.row.about_me }}
          </b-table-column>

          <b-table-column field="created_at" label="Registration date" sortable v-slot="props">
            {{ props.row.created_at | datetime }}
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
  name: 'UsersList',
  data () {
    return {
      users: [],
      isLoading: false,
      query: '',
      limit: 30,
      page: 0,
      total: 0,
      sortField: 'id',
      sortOrder: 'asc',
      canLoadMore: true,
      source: null
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.page * this.limit,
        sort: this.sortField,
        direction: this.sortOrder
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.users = []
      this.page = 0
      this.total = 0
      this.canLoadMore = true
      this.fetchData()
    },
    onPageChange (page) {
      this.page = page - 1
      this.fetchData()
    },
    onSort (field, order) {
      this.sortField = field
      this.sortOrder = order
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/members', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.users = response.data.data
        this.total = response.data.meta.count
        this.page++
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }
        this.isLoading = false

        this.$root.showError('Could not fetch user list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
