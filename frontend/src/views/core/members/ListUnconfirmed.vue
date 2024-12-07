<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Unconfirmed user list</h4>
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

          <b-table-column field="email" label="Email" v-slot="props">
            {{ props.row.email }}
          </b-table-column>

          <b-table-column field="created_at" label="Registration date" sortable v-slot="props">
            {{ props.row.created_at | datetime }}
          </b-table-column>

          <b-table-column label="Confirm" v-slot="props">
            <a class="button is-small is-info" @click="askConfirm(props.row, props.index)">
              <span class="icon"><font-awesome-icon icon="plus" /></span>
              <span>Confirm</span>
            </a>
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
  name: 'UnconfirmedUsersList',
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
    askConfirm (user, index) {
      this.$buefy.dialog.confirm({
        title: 'Confirm user',
        message: 'Are you sure you want to <b>confirm</b> this user?',
        confirmText: 'Confirm user',
        type: 'is-primary',
        icon: 'plus-circle',
        hasIcon: true,
        onConfirm: () => this.confirm(user, index)
      })
    },
    confirm (user, index) {
      this.axios.post(this.services['core'] + '/members/' + user.id + '/confirm').then(() => {
        this.$root.showSuccess('User is confirmed.')
        this.users.splice(index, 1)
      }).catch((err) => {
        this.$root.showError('Error changing user status', err)
      })
    },
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

      this.axios.get(this.services['core'] + '/members/unconfirmed', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
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
