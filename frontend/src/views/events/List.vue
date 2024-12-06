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

        <div class="field">
          <label class="label">Event types</label>
          <label v-for="(value, index) in eventTypes" v-bind:key="index">
            <input class="checkbox" type="checkbox" v-model="value.enabled" @change="refetch()" />
            {{ value.name }}
          </label>
        </div>

        <div class="field">
          <div class="control">
            <b-switch v-model="displayTiles" :rounded="true">Display experimental view</b-switch>
          </div>
        </div>

        <div class="field" v-if="can.createEvent">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.events.create' }">Create event</router-link>
          </div>
        </div>

        <!-- List view -->
        <template v-if="!displayTiles">
          <div class="card" v-for="event in events" v-bind:key="event.id">
            <div class="card-content">
              <div class="media">
                <div class="media-left">
                  <figure class="image is-96x96">
                    <img v-if="!event.image" src="/images/logo.png">
                    <img v-if="event.image" :src="services['events-static'] + '/headimages/' + event.image" style="max-height: 96px; object-fit: contain">
                  </figure>
                </div>
                <div class="media-content">
                  <router-link :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }">
                    <p class="title is-4">{{ event.name }}</p>
                  </router-link>
                </div>
              </div>

              <div class="content">
                <span v-html="$options.filters.markdown(event.description)" />
                <ul>
                  <li><strong>Type:</strong> {{ eventTypesNames[event.type] }} </li>
                  <li><strong>From:</strong> {{ event.starts | date }} </li>
                  <li><strong>To:</strong> {{ event.ends | date }} </li>
                  <li><strong>Application period: </strong>
                    <span>{{ event.application_starts | date }} - {{ event.application_ends | date }}</span>
                  </li>
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
                      :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }"
                      class="button">Go to event page</router-link>
                  </p>
                  <p class="control">
                    <router-link
                      :to="{ name: 'oms.events.apply', params: { id: event.url || event.id, application_id: 'me' } }"
                      class="button is-warning">
                      My application
                    </router-link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Tile view -->
        <template v-else>
          <div class="columns is-multiline">
            <div class="column is-one-quarter" v-for="event in events" v-bind:key="event.id">
              <div class="card">
                <div class="card-content">
                  <figure class="image is-square">
                    <img v-if="!event.image" src="/images/logo.png">
                    <img v-if="event.image" :src="services['events-static'] + '/headimages/' + event.image" style="object-fit: contain; margin: auto">
                  </figure>

                  <div class="content" style="padding-top: 1rem">
                    <ul style="list-style-type: none; padding: 0; margin: 0">
                      <li><span class="title is-4">{{ event.name }}</span></li>
                      <li style="display: flex; justify-content: space-between;">
                        <span class="tag" :style="{ 'background-color': colors[event.type], color: '#FFFFFF' }">
                          {{ eventTypesNames[event.type] }}
                        </span>
                        <span v-if="today.isBefore(event.application_starts)" class="tag is-warning">Apply after {{ event.application_starts | date }}</span>
                        <span v-if="event.application_status === 'open'" class="tag is-success">Apply before {{ event.application_ends | date }}</span>
                        <span v-if="today.isAfter(event.application_ends)" class="tag is-light">Applications are closed</span>
                      </li>
                    </ul>

                    <table>
                      <tr>
                        <td><span class="subtitle is-4"><font-awesome-icon :icon="['fa', 'calendar']" /></span></td>
                        <td>
                          <span>{{ event.starts | date }}</span>
                          <span v-if="!isOneDayEvent(event.starts, event.ends)"> - {{ event.ends | date }}</span>
                        </td>
                      </tr>
                      <tr>
                        <td><span class="subtitle is-4"><font-awesome-icon :icon="['fa', 'coins']" /></span></td>
                        <td>
                          <span v-if="event.fee">€{{ event.fee }}</span>
                          <span v-else><i>Free</i></span>
                          <span v-if="event.optional_fee"> (+ €{{ event.optional_fee }})</span>
                        </td>
                      </tr>
                      <tr>
                        <td><span class="subtitle is-4"><font-awesome-icon :icon="['fa', 'users']" /></span></td>
                        <td>
                          <ul style="list-style-type: none; padding: 0; margin: 0">
                            <li v-for="(body, index) in event.organizing_bodies" v-bind:key="index">
                              <router-link
                                v-bind:key="index"
                                :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                                {{ body.body_name }}
                              </router-link>
                            </li>
                          </ul>
                        </td>
                      </tr>
                    </table>

                    <div class="field is-grouped">
                      <p class="control">
                        <router-link
                          :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }"
                          class="button">Go to event page</router-link>
                      </p>

                      <p class="control" v-if="event.status === 'published' && event.application_status === 'open'">
                        <router-link
                          :to="{ name: 'oms.events.apply', params: { id: event.url || event.id, application_id: 'me' } }"
                          class="button is-success">
                          Apply!
                        </router-link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

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
import constants from '../../constants'

export default {
  name: 'EventsList',
  data () {
    const eventTypes = Object.entries(constants.EVENT_TYPES_NAMES).map(([value, name]) => ({
      value,
      name,
      enabled: false
    }))

    return {
      events: [],
      eventTypes,
      eventTypesNames: constants.EVENT_TYPES_NAMES,
      isLoading: {
        events: false,
        permissions: false
      },
      query: '',
      limit: 30,
      offset: 0,
      displayPast: false,
      displayTiles: false,
      colors: {
        training: '#A0C514',
        conference: '#931991',
        nwm: '#FBBA00',
        cultural: '#C51C13'
      },
      today: moment(),
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
        offset: this.offset,
        type: this.eventTypes.filter(type => type.enabled).map(type => type.value)
      }

      if (!this.displayPast) queryObj.starts = moment().format('YYYY-MM-DD')

      if (this.query) queryObj.search = this.query
      return queryObj
    },
    scope () {
      if (this.$route.name === 'oms.events.list.all') return 'all'
      if (this.$route.name === 'oms.events.list.participating') return 'participating'
      if (this.$route.name === 'oms.events.list.organizing') return 'organizing'

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
    isOneDayEvent (start, end) {
      return moment(start).isSame(moment(end), 'day')
    },
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
        all: this.services['events'],
        organizing: this.services['events'] + '/mine/organizing',
        participating: this.services['events'] + '/mine/participating'
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
