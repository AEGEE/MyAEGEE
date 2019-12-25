<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">User list</h4>
        <div class="field">
          <label class="label">Search by name or surname</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name or surname" @input="refetch()">
          </div>
        </div>

        <b-table
          :data="users"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="first_name" label="Name and surname" sortable width="150">
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.seo_url || props.row.id } }">
                {{ props.row.first_name }} {{ props.row.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="birthday" label="Birthday" sortable width="150">
              {{ props.row.date_of_birth }}
            </b-table-column>

            <b-table-column field="address" label="Address">
              {{ props.row.address }}
            </b-table-column>

            <b-table-column field="about_me" label="About me">
              {{ props.row.about_me }}
            </b-table-column>
          </template>

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
            @click="fetchData()">Load more users</button>
        </div>
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
      this.users = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/members', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.users = this.users.concat(response.data.data)
        this.offset += this.limit
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
