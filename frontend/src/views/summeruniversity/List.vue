<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List of Summer Universities</h4>
        <div class="notification is-info">
          <div class="content">
            <p>On this page you will find the list of all Summer Universities that are most probably going to happen this summer. There are some however which are not open yet to applications,
              these SUs will open soon, once they have all information ready. In case you cannot find a SU anymore, it means they sadly had to cancel organizing it.</p>
            <p>To apply to a Summer University you will need to be a member of a local and login on MyAEGEE. You will be able to apply only to <strong>ONE</strong> SU at the same time.</p>
            <p>Make sure you read the information of each SU carefully before applying, as there is crucial information in regards to COVID-19.</p>
            <p>We hope you will apply to an amazing adventure this summer!</p>
          </div>
        </div>
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
          <label class="label">Select year</label>
          <div class="control">
            <div class="select">
              <select v-model="season" @change="refetch()">
                <option value="2021">2021</option>
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option selected value="2025">2025</option>
              </select>
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
          <label class="label">Application status</label>
          <label v-for="(value, index) in applicationStatuses" v-bind:key="index">
            <input class="checkbox" type="checkbox" v-model="value.enabled" @change="refetch()" />
            {{ value.name }}
          </label>
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
              <span v-if="event.application_status === 'open'" style="color: #647A16; font-weight: bold">Applications are open!</span>
              <span v-html="$options.filters.markdown(event.description)" />
              <ul>
                <li><strong>Type:</strong> {{ eventTypesNames[event.type] }} </li>
                <li><strong>From:</strong> {{ event.starts | date }} </li>
                <li><strong>To:</strong> {{ event.ends | date }} </li>
                <li v-if="event.application_status === 'open' && event.open_call != true"><strong>Application deadline: </strong>
                  <span>{{ event.application_ends | datetime }}</span>
                </li>
                <li v-if="event.open_call === true"><strong>Spots available:</strong> {{ event.available_spots }} </li>
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
                <p class="control" v-if="can.apply">
                  <router-link
                    :to="{ name: 'oms.summeruniversity.apply', params: { id: event.url || event.id, application_id: 'me' } }"
                    class="button is-primary">
                    Apply
                  </router-link>
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
import constants from '../../constants'

export default {
  name: 'EventsList',
  data () {
    const eventTypes = Object.entries(constants.SUMMERUNIVERSITY_TYPES_NAMES).map(([value, name]) => ({
      value,
      name,
      enabled: false
    }))

    const applicationStatuses = Object.entries(constants.SUMMERUNIVERSITY_APPLICATION_STATUS_NAMES).map(([value, name]) => ({
      value,
      name,
      enabled: false
    }))

    return {
      events: [],
      eventTypes,
      eventTypesNames: constants.SUMMERUNIVERSITY_TYPES_NAMES,
      applicationStatuses,
      season: 2025,
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
        createEvent: false,
        apply: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset,
        type: this.eventTypes.filter(type => type.enabled).map(type => type.value),
        application_status: this.applicationStatuses.filter(type => type.enabled).map(type => type.value),
        season: this.season
      }

      if (!this.displayPast) queryObj.starts = moment().format('YYYY-MM-DD')

      if (this.query) queryObj.search = this.query
      return queryObj
    },
    scope () {
      if (this.$route.name === 'oms.summeruniversity.list.all') return 'all'
      if (this.$route.name === 'oms.summeruniversity.list.participating') return 'participating'
      if (this.$route.name === 'oms.summeruniversity.list.organizing') return 'organizing'

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
        all: this.services['summeruniversity'],
        organizing: this.services['summeruniversity'] + '/mine/organizing',
        participating: this.services['summeruniversity'] + '/mine/participating'
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
        this.can.createEvent = response.data.data.some(permission => permission.combined.endsWith('create:summeruniversity'))

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
