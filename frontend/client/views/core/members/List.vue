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

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name and surname</th>
                <th>Birthday</th>
                <th>Address</th>
                <th>About user</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name and surname</th>
                <th>Birthday</th>
                <th>Address</th>
                <th>About user</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="users.length" v-for="user in users" v-bind:key="user.id">
                <td>
                  <router-link :to="{ name: 'oms.members.view', params: { id: user.seo_url || user.id } }">
                    {{ user.first_name + ' ' + user.last_name }}
                  </router-link>
                </td>
                <td>{{ user.date_of_birth }}</td>
                <td>{{ user.address }}</td>
                <td>{{ user.about_me }}</td>
              </tr>
              <tr v-show="!users.length && !isLoading">
                <td colspan="4" class="has-text-centered">User list is empty</td>
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
              @click="fetchData()">Load more users</button>
          </div>
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
          return console.debug('Request cancelled.')
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch user list: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
