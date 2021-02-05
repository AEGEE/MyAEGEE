<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['summeruniversity-static'] + '/headimages/' + event.image">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.edit_event">
            <router-link :to="{ name: 'oms.summeruniversity.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.delete_event">
            <a class="button is-fullwidth is-danger" @click="askDeleteEvent()">
              <span>Delete event</span>
              <span class="icon"><font-awesome-icon icon="times" /></span>
            </a>
          </div>
        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ event.name }}</p>

          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Event name</th>
                  <td>{{ event.name }}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>
                    <div class="content" v-html="$options.filters.markdown(event.description)"></div>
                  </td>
                </tr>
                <tr>
                  <th>Max. participants</th>
                  <td>{{ event.max_participants }}</td>
                </tr>
                <tr>
                  <th>Starts <timezone-tooltip /></th>
                  <td>{{ event.starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Ends <timezone-tooltip /></th>
                  <td>{{ event.ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr v-if="event.optional_fee">
                  <th>Optional Fee</th>
                  <td>€{{ event.optional_fee }}</td>
                </tr>
                <tr v-if="event.optional_programme">
                  <th>Optional programme</th>
                  <td>{{ event.optional_programme }}</td>
                </tr>
                <tr>
                  <th>Accommodation type</th>
                  <td>{{ event.accommodation_type }}</td>
                </tr>
                <tr v-if="can.approve_event ">
                  <th>Status</th>
                  <td>{{ event.status | capitalize }}</td>
                </tr>
                <tr>
                  <th>Organizing bodies</th>
                  <td>
                    <ul>
                      <li v-for="body in event.organizing_bodies" v-bind:key="body._id">
                        <router-link class="tag" :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                          {{ body.body_name }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>

            <table class="table is-narrow" v-if="event.budget || event.programme">
              <tbody>
                <tr>
                  <th>Budget link</th>
                  <td>
                    <a v-if="event.budget" :href="event.budget" target="_blank">{{ event.budget }}</a>
                  </td>
                </tr>
                <tr>
                  <th>Programme link</th>
                  <td>
                    <a v-if="event.programme_suct" :href="event.programme_suct" target="_blank">{{ event.programme_suct }}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="notification is-info" v-if="event.status !== 'published'">
            <p><strong>This event is visible to SUCT and organizers only because it's not approved yet.</strong></p>
            <p>Once the event will be published, others would be able to access it.</p>
          </div>

          <div class="tile" style="position: relative; height: 400px" v-if="this.event.locations.length > 0">
            <MglMap
              id="map"
              :accessToken="accessToken"
              :mapStyle="map.style"
              :zoom="map.zoom"
              :scrollZoom="false"
              @load="onMapLoaded"
              :center="map.center">
              <MglNavigationControl position="top-right" />
              <MglMarker
                v-for="(location, index) in event.locations"
                v-bind:key="index"
                :coordinates="location.position"
                color="red">
                <MglPopup>
                  <div class="mapbox-popup-custom">{{ location.name }}</div>
                </MglPopup>
              </MglMarker>
            </MglMap>
          </div>
        </div>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Mapbox from 'mapbox-gl'
import { MglMap, MglMarker, MglPopup, MglNavigationControl } from 'vue-mapbox'
import constants from '../../constants'
import credentials from '../../credentials'
import TimezoneTooltip from '../../components/tooltips/TimezoneTooltip'

export default {
  components: {
    MglMap,
    MglMarker,
    MglPopup,
    MglNavigationControl,
    TimezoneTooltip
  },
  name: 'SingleEvent',
  data () {
    return {
      event: {
        name: '',
        description: '',
        id: null,
        url: null,
        organizers: [],
        organizing_bodies: [],
        locations: [],
        circles: [],
        application_starts: null,
        application_ends: null,
        starts: null,
        ends: null,
        application_status: 'closed',
        head_image: null,
        status: 'published',
        optional_fee: null,
        meals_per_day: 0,
        optional_programme: null,
        link_info_travel_country: null,
        accommodation_type: ''
      },
      eventTypes: constants.EVENT_TYPES_NAMES,
      accessToken: '',
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 8
      },
      isLoading: false,
      can: {
        edit_event: false,
        approve_event: true,
        view_applications: false,
        apply: false,
        change_status: {
          draft: false,
          submitted: false,
          published: false
        }
      }
    }
  },
  methods: {
    askDeleteEvent () {
      this.$buefy.dialog.confirm({
        title: 'Deleting an event',
        message: 'Are you sure you want to <b>delete this event</b>?',
        confirmText: 'Delete event',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteEvent()
      })
    },
    deleteEvent () {
      this.axios.delete(this.services['summeruniversity'] + '/single/' + this.event.id).then(() => {
        this.$root.showInfo('Event is deleted.')
        this.$router.push({ name: 'oms.summeruniversity.list.all' })
      }).catch((err) => this.$root.showError('Could not delete event', err))
    },
    askChangeStatus (newStatus) {
      if (this.event.status === 'draft') {
        if (!this.event.budget) {
          this.$root.showError('Please set the budget for the event in the event settings.')
        }

        if (!this.event.programme) {
          this.$root.showError('Please set the program for the event in the event settings.')
        }

        if (!this.event.budget || !this.event.programme) {
          return
        }
      }

      this.$buefy.dialog.confirm({
        title: 'Change status',
        message: `Are you sure you want to <b>change this event status to "${newStatus}"</b>?`,
        confirmText: 'Change status',
        type: 'is-warning',
        hasIcon: true,
        onConfirm: () => this.changeStatus(newStatus)
      })
    },
    changeStatus (newStatus) {
      this.isLoading = true
      const body = { status: newStatus }

      this.axios.put(this.services['summeruniversity'] + '/single/' + this.event.id + '/status', body).then(() => {
        this.$root.showInfo(`Event status is now ${newStatus}`)

        // Refetching the event to renew the permissions.
        return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id)
      }).then((response) => {
        this.event = response.data.data
        this.can = response.data.permissions
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not delete event', err)
      })
    },
    onMapLoaded (event) {
      this.map.actions = event.component.actions

      // waiting till the event is loaded.
      if (!this.isLoading && this.event.id) {
        this.centerMap()
      }
    },
    centerMap () {
      // we don't know, what'll happen first, the map will load or the event will load.
      // and we need both to be loaded.
      if (this.event.locations.length === 0) {
        return
      }

      // if it's a single point, then just centering on it
      if (this.event.locations.length === 1) {
        this.map.actions.flyTo({ center: this.event.locations[0].position })
        return
      }

      this.map.actions.fitBounds(this.event.locations.map(location => location.position), { padding: 50 })
    }
  },
  mounted () {
    this.mapbox = Mapbox
    this.isLoading = true

    this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      this.isLoading = false

      if (this.map.actions) {
        this.centerMap()
      }
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.summeruniversity.list.all' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    isOrganizer () {
      return this.event.organizers.some(org => org.user_id === this.loginUser.id)
    }
  }
}
</script>
