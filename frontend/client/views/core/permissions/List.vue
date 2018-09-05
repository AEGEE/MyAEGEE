<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Permissions list</h4>
        <div class="field">
          <label class="label">Search permission</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search permissions" @input="refetch()">
          </div>
        </div>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.permissions.create' }">Create permission</router-link>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Permission code</th>
                <th>Description</th>
                <th>Additional info</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Permission code</th>
                <th>Description</th>
                <th>Additional info</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="permissions.length" v-for="permission in permissions" v-bind:key="permission.id">
                <td>
                  <router-link :to="{ name: 'oms.permissions.view', params: { id: permission.id } }">
                    {{ permission.combined }}
                  </router-link>
                </td>
                <td>{{ permission.description }}</td>
                <td>
                  <span class="tag is-info" v-if="permission.always_assigned">Always assigned</span>
                  <span class="tag is-warning" v-if="permission.filters.length > 0">Has filters</span>
                </td>
              </tr>
              <tr v-show="!permissions.length && !isLoading">
                <td colspan="3" class="has-text-centered">Permissions list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="3" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              :class="{ 'is-loading': isLoading }"
              :disabled="isLoading"
              v-show="canLoadMore"
              @click="fetchData()">Load more permissions</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'PermissionsList',
  data () {
    return {
      permissions: [],
      myPermissions: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
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
      this.permissions = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/permissions', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.permissions = this.permissions.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      }).then((response) => {
        this.myPermissions = response.data.data

        this.can.create = this.myPermissions.some(permission => permission.combined.endsWith('create:permission'))

        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch permissions list: ' + err.message)

        this.isLoading = false
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
