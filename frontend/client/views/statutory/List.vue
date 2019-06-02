<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Statutory events list</h4>
        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name or description" @input="refetch()" />
            </div>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <router-link class="button is-primary" v-if="can.create" :to="{ name: 'oms.statutory.create' }">Create event</router-link>
          </div>
        </div>

        <div class="card" v-for="event in events" v-bind:key="event.id">
          <div class="card-content">
            <div class="media">
              <div class="media-left">
                <figure class="image image-96px">
                  <img v-if="!event.image" src="/images/logo.png">
                  <img v-if="event.image" :src="services['oms-statutory'] + event.image.frontend_path">
                </figure>
              </div>
              <div class="media-content">
                <router-link :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }">
                  <p class="title is-4">{{ event.name }}</p>
                </router-link>
              </div>
            </div>

            <div class="content">
              <span v-html="$options.filters.markdown(event.description)"></span>
              <ul>
                <li><strong>Type:</strong> {{ event.type }} </li>
                <li><strong>From:</strong> {{ event.starts | date }} </li>
                <li><strong>To:</strong> {{ event.ends | date }} </li>
                <li>
                  <strong>Application period:</strong>
                  from {{ event.application_period_starts | date }} to {{ event.application_period_ends | date }}
                </li>
              </ul>

              <div class="field is-grouped">
                <p class="control">
                  <router-link
                    :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }"
                    class="button">Go to event page</router-link>
                </p>
                <p class="control" v-if="event.can_apply">
                  <router-link
                    :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: 'me' } }"
                    class="button is-warning">
                    Apply
                  </router-link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-show="events.length === 0 && !isLoading">
          <div class="card-content">
            <div class="media">
              <div class="media-content">
                <p class="title has-text-centered">No events found.</p>
              </div>
            </div>
          </div>
        </div>


        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more events</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style>
.image-96px {
  width:96px;
}
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'StatutoryList',
  data () {
    return {
      events: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      can: { create: false },
      permissions: []
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (this.query) queryObj.search = this.query
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.events = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-statutory'], { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.events = this.events.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission =>
          permission.combined.endsWith('manage_event:agora') || permission.combined.endsWith('manage_event:epm'))
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch statutory events list: ' + err.message)
      })
    }
  },
  watch: {
    '$route.name' () {
      this.fetchData()
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
