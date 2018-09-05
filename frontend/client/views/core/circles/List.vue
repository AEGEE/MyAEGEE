<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Circles list</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
          </div>
        </div>

        <div class="field is-grouped">
          <div class="control" v-if="can.createFree">
            <router-link class="button is-primary" :to="{ name: 'oms.circles.create' }">Create circle</router-link>
          </div>

          <a class="button" v-if="includeBoundCircles" @click="toggleBoundCircles()">Show only free circles</a>
          <a class="button" v-if="!includeBoundCircles" @click="toggleBoundCircles()">Show also bound circles</a>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="circles.length" v-for="circle in circles" v-bind:key="circle.id">
                <td>
                  <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id } }">
                    {{ circle.name }}
                  </router-link>
                </td>
                <td>{{ circle.description }}</td>
              </tr>
              <tr v-show="!circles.length && !isLoading">
                <td colspan="2" class="has-text-centered">Circles list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="2" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              :class="{ 'is-loading': isLoading }"
              :disabled="isLoading"
              v-show="canLoadMore"
              @click="fetchData()">Load more circles</button>
          </div>
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
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/circles', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.circles = this.circles.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.createFree = this.permissions.some(permission => permission.combined.endsWith('create:free_circle'))
        this.can.createBound = this.permissions.some(permission => permission.combined.endsWith('create:bound_circle'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch circles list: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
