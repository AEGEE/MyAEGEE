<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['oms-events-static'] + '/headimages/' + event.image">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.list_applications">
            <router-link :to="{ name: 'oms.events.participants', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View applications</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <!--<div class="field is-grouped" v-if="can.view_applications">
            <router-link :to="{ name: 'oms.events.accepted', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View participants</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>-->

          <div class="field is-grouped" v-if="event.status === 'published'">
            <router-link :to="{ name: 'oms.events.apply', params: { id: event.url || event.id, application_id: 'me' } }" class="button is-warning is-fullwidth">
              <span>Manage my application</span>
              <span class="icon"><i class="fa fa-plus"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <router-link :to="{ name: 'oms.events.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <router-link :to="{ name: 'oms.events.edit_organizers', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit organizers</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.delete_event">
            <a class="button is-fullwidth is-danger" @click="askDeleteEvent()">
              <span>Delete event</span>
              <span class="icon"><i class="fa fa-times"></i></span>
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
                  <td>
                </tr>
                <tr>
                  <th>Max. participants</th>
                  <td>{{ event.max_participants }}</td>
                </tr>
                <tr>
                  <th>Application status</th>
                  <td>{{ event.application_status | capitalize }}</td>
                </tr>
                <tr>
                  <th>Application period starts</th>
                  <td>{{ event.application_starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Application period ends</th>
                  <td>{{ event.application_ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Starts</th>
                  <td>{{ event.starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Ends</th>
                  <td>{{ event.ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td>{{ eventTypes[event.type] }}</td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{{ event.status | capitalize }}</td>
                </tr>
                <tr>
                  <th>Organizing bodies</th>
                  <td>
                    <ul>
                      <li v-for="body in event.organizing_bodies" v-bind:key="body._id">
                        <router-link class="tag" :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                          {{ body.body ? body.body.name : 'Loading...' }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
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
import constants from  '../../constants'
import credentials from  '../../credentials'

export default {
  components: {
    MglMap,
    MglMarker,
    MglPopup,
    MglNavigationControl
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
        status: 'Draft'
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
        view_applications: false,
        apply: false
      }
    }
  },
  methods: {
    askDeleteEvent () {
      this.$buefy.dialog.confirm({
        title: 'Deleting an event',
        message: `Are you sure you want to <b>delete this event</b>?`,
        confirmText: 'Delete event',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteEvent()
      })
    },
    deleteEvent () {
      this.axios.delete(this.services['oms-events'] + '/single/' + this.event.id).then((response) => {
        this.$root.showInfo('Event is deleted.')
        this.$router.push({ name: 'oms.events.list.all' })
      }).catch((err) => this.$root.showDanger('Could not delete event: ' + err.message))
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

    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions
      this.isLoading = false

      for (const body of this.event.organizing_bodies) {
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + body.body_id).then((bodyResponse) => {
          this.$set(body, 'body', bodyResponse.data.data)
        }).catch(console.error)
      }

      if (this.map.actions) {
        this.centerMap()
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list.all' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    })
  }
}
</script>