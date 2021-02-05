<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Events list</h4>
        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name or description" @input="refetch()" />
            </div>
            <div class="control">
              <a class="button is-info" @click="toggleDisplayPast()">
                {{ this.displayPast ? 'Display only future events' : 'Display past events' }}
              </a>
            </div>
          </div>
        </div>

        <div class="field" v-if="can.createEvent">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.summeruniversity.create' }">Create event</router-link>
          </div>
        </div>

        <div class="card" v-for="event in events" v-bind:key="event.id">
          <div class="card-content">
            <div class="media">
              <div class="media-left">
                <figure class="image is-96x96">
                  <img v-if="!event.image" src="/images/logo.png">
                  <img v-if="event.image" :src="services['summeruniversity-static'] + '/headimages/' + event.image">
                </figure>
              </div>
              <div class="media-content">
                <router-link :to="{ name: 'oms.summeruniversity.view', params: { id: event.url || event.id } }">
                  <p class="title is-4">{{ event.name }}</p>
                </router-link>
              </div>
            </div>

            <div class="content">
              <span v-html="$options.filters.markdown(event.description)"></span>
              <ul>
                <li><strong>From:</strong> {{ event.starts | date }} </li>
                <li><strong>To:</strong> {{ event.ends | date }} </li>
                <li>
                  <strong>Organizing bodies: </strong>
                    <router-link
                      v-for="(body, index) in event.organizing_bodies"
                      v-bind:key="index"
                      :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                      {{ body.body_name }}
                    </router-link>
                </li>
              </ul>

              <div class="field is-grouped">
                <p class="control">
                  <router-link
                    :to="{ name: 'oms.summeruniversity.view', params: { id: event.url || event.id } }"
                    class="button">Go to event page</router-link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="card" v-show="events.length === 0 && !isLoadingSomething">
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
            :class="{ 'is-loading': isLoadingSomething }"
            :disabled="isLoadingSomething"
            v-show="canLoadMore"
            @click="fetchData()">Load more events</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { mapGetters } from 'vuex'

export default {
  name: 'EventsList',
  data () {
    return {
      events: [],
      isLoading: {
        events: false,
        permissions: false
      },
      query: '',
      limit: 30,
      offset: 0,
      displayPast: false,
      canLoadMore: true,
      source: null,
      can: {
        createEvent: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (!this.displayPast) queryObj.starts = moment().format('YYYY-MM-DD')

      if (this.query) queryObj.search = this.query
      return queryObj
    },
    scope () {
      if (this.$route.name === 'oms.summeruniversity.list.all') return 'all'

      throw new Error('Unknown scope: ' + this.$route.name)
    },
    isLoadingSomething () {
      return this.isLoading.permissions || this.isLoading.events
    },
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    toggleDisplayPast () {
      this.displayPast = !this.displayPast
      this.refetch()
    },
    refetch () {
      this.events = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading.events = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      const urls = {
        all: this.services['summeruniversity']
      }

      this.axios.get(urls[this.scope], { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.events = this.events.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = this.scope === 'all' && response.data.data.length === this.limit

        this.isLoading.events = false
      }).catch((err) => {
        this.isLoading.events = false

        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch events list', err)
      })
    },
    fetchPermissions () {
      if (!this.loginUser) {
        return
      }

      this.isLoading.permissions = true

      this.axios.get(this.services['core'] + '/my_permissions').then((response) => {
        this.can.createEvent = response.data.data.some(permission => permission.combined.endsWith('create:event'))

        this.isLoading.permissions = false
      }).catch((err) => {
        this.isLoading.permissions = false

        this.$root.showWarning('Could not fetch permissions', err)
      })
    }
  },
  watch: {
    '$route.name': function () {
      this.refetch()
    }
  },
  mounted () {
    this.refetch()
    this.fetchPermissions()
  }
}
</script>
