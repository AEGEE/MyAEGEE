<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Circles list</h4>

        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
            </div>
            <div class="control">
              <a class="button is-info" v-if="includeBoundCircles" @click="toggleBoundCircles()">Show only free circles</a>
              <a class="button is-info" v-if="!includeBoundCircles" @click="toggleBoundCircles()">Show also bound circles</a>
            </div>
          </div>
        </div>

        <div class="field is-grouped">
          <div class="control" v-if="can.createFree">
            <router-link class="button is-primary" :to="{ name: 'oms.circles.create' }">Create circle</router-link>
          </div>
        </div>

        <b-table
          :data="circles"
          :loading="isLoading">
          <b-table-column field="name" label="Circle name" width="150" v-slot="props">
            <router-link :to="{ name: 'oms.circles.view', params: { id: props.row.id } }">
              {{ props.row.name }}
            </router-link>
          </b-table-column>

          <b-table-column field="description" label="Description" v-slot="props">
            {{ props.row.description }}
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
            @click="fetchData()">
            Load more circles
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'CirclesList',
  data () {
    return {
      circles: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      permissions: [],
      includeBoundCircles: false,
      can: {
        createFree: false,
        createBound: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset,
        all: this.includeBoundCircles
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    toggleBoundCircles () {
      this.includeBoundCircles = !this.includeBoundCircles
      this.refetch()
    },
    refetch () {
      this.circles = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/circles', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.circles = this.circles.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['core'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.createFree = this.permissions.some(permission => permission.combined.endsWith('create:free_circle'))
        this.can.createBound = this.permissions.some(permission => permission.combined.endsWith('create:bound_circle'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch circles list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
