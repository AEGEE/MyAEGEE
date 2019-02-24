<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['oms-events'] + '/frontend/media/headimages/' + event.image">
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

          <div class="field is-grouped" v-if="can.apply">
            <router-link :to="{ name: 'oms.events.apply', params: { id: event.url || event.id } }" class="button is-warning is-fullwidth">
              <span>Apply</span>
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
                  <td>{{ event.type }}</td>
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

          <GmapMap
            v-if="event.locations.length > 0"
            :zoom="7"
            :class="is-fullwidth"
            :center="map.center"
            style="height: 400px"
            ref="mapRef" >
            <gmap-info-window
              v-if="map.selectedMarkerIndex != null"
              :position="event.locations[map.selectedMarkerIndex].position"
              :options="map.infoOptions"
              @closeclick="map.selectedMarkerIndex = null">
              {{ event.locations[map.selectedMarkerIndex].name }}
            </gmap-info-window>
            <GmapMarker
              :key="index"
              v-for="(marker, index) in event.locations"
              :position="marker.position"
              @click="map.selectedMarkerIndex = index"
              :draggable="false" />
          </GmapMap>
        </div>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { gmapApi } from 'vue2-google-maps'

export default {
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
      map: {
        center: { lat: 50.8503396, lng: 4.3517103 },
        selectedMarkerIndex: null,
        infoOptions: {
          pixelOffset: {
            width: 0,
            height: -35
          }
        }
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
      this.$dialog.confirm({
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
    }
  },
  mounted () {
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

      // loading map
      if (this.event.locations.length > 0) {
        this.$nextTick()
          .then(() => this.$refs.mapRef.$mapPromise)
          .then((map) => {
            // if it's a single point, then just centering on it
            if (this.event.locations.length === 1) {
              this.$refs.mapRef.$mapObject.panTo(this.event.locations[0].position)
              return
            }

            // if there are multiple points, then fit them into map.
            const bounds = new this.google.maps.LatLngBounds()
            for (const marker of this.event.locations) {
              bounds.extend(marker.position)
            }

            this.$refs.mapRef.$mapObject.fitBounds(bounds)
          })
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
    }),
    google: gmapApi
  }
}
</script>
