<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Bodies list</h4>
        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name or description" @input="refetch()">
          </div>
        </div>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.bodies.create' }">Create body</router-link>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Body code</th>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Body code</th>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="bodies.length" v-for="body in bodies" v-bind:key="body.id">
                <td>{{ body.legacy_key }}</td>
                <td>
                  <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id } }">{{ body.name}}</router-link>
                </td>
                <td>
                  <span v-html="$options.filters.markdown(body.description)"></span>
                </td>
              </tr>
              <tr v-show="!bodies.length && !isLoading">
                <td colspan="4" class="has-text-centered">Bodies list is empty</td>
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
              @click="fetchData()">Load more bodies</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BodiesList',
  data () {
    return {
      bodies: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      permissions: [],
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
      this.bodies = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/bodies', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.bodies = this.bodies.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:body'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch bodies list: ' + err.message,
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
