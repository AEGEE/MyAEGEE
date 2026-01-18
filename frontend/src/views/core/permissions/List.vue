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

        <b-table
          :data="permissions"
          :loading="isLoading">
          <b-table-column field="combined" label="Permission code" sortable width="200" v-slot="props">
            <router-link :to="{ name: 'oms.permissions.view', params: { id: props.row.id } }">
              {{ props.row.combined }}
            </router-link>
          </b-table-column>

          <b-table-column field="description" label="Description" v-slot="props">
            {{ props.row.description }}
          </b-table-column>

          <b-table-column label="Additional info" v-slot="props">
            <span class="tag is-info" v-if="props.row.always_assigned">Always assigned</span>
            <span class="tag is-warning" v-if="props.row.filters.length > 0">Has filters</span>
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
            @click="fetchData()">Load more permissions</button>
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
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/permissions', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.permissions = this.permissions.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['core'] + '/my_permissions')
      }).then((response) => {
        this.myPermissions = response.data.data

        this.can.create = this.myPermissions.some(permission => permission.combined.endsWith('create:permission'))

        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch permissions list', err)

        this.isLoading = false
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
