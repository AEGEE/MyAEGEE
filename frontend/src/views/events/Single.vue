<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['events-static'] + '/headimages/' + event.image">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.list_applications">
            <router-link :to="{ name: 'oms.events.participants', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View applications</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <!--<div class="field is-grouped" v-if="can.view_applications">
            <router-link :to="{ name: 'oms.events.accepted', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View participants</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>-->

          <div class="field is-grouped" v-if="event.status === 'published'">
            <router-link :to="{ name: 'oms.events.apply', params: { id: event.url || event.id, application_id: 'me' } }" class="button is-warning is-fullwidth">
              <span>Manage my application</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <a class="button is-fullwidth is-primary" data-cy="picture-change-link" @click="openPictureModal()">
              <span>Change picture</span>
              <span class="icon"><font-awesome-icon icon="camera" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <router-link :to="{ name: 'oms.events.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <!-- For LOs/EQAC: ask for approval (draft -> submitted) -->
          <div class="field is-grouped" v-if="can.change_status.submitted && event.status === 'draft'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('submitted')">
              <span>Ask for approval</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For EQAC: unpublish event (published -> submitted)  -->
          <div class="field is-grouped" v-if="can.change_status.submitted && event.status === 'published'">
            <a class="button is-fullwidth is-danger" @click="askChangeStatus('submitted')">
              <span>Unpublish</span>
              <span class="icon"><font-awesome-icon icon="times-circle" /></span>
            </a>
          </div>

          <!-- For EQAC: approve (submitted -> published) -->
          <div class="field is-grouped" v-if="can.change_status.published && event.status === 'submitted'">
            <a class="button is-fullwidth is-primary" @click="askChangeStatus('published')">
              <span>Approve event</span>
              <span class="icon"><font-awesome-icon icon="check" /></span>
            </a>
          </div>

          <!-- For EQAC: reject/request for changes (submitted -> draft) -->
          <div class="field is-grouped" v-if="can.change_status.draft && event.status === 'submitted'">
            <a class="button is-fullwidth is-danger" @click="askChangeStatus('draft')">
              <span>Request changes</span>
              <span class="icon"><font-awesome-icon icon="times-circle" /></span>
            </a>
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
                    <div class="content" v-html="$options.filters.markdown(event.description)" />
                  </td>
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
                  <th>Application period starts <timezone-tooltip /></th>
                  <td>{{ event.application_starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Application period ends <timezone-tooltip /></th>
                  <td>{{ event.application_ends | datetime }}</td>
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
                  <th>Type</th>
                  <td>{{ eventTypes[event.type] }}</td>
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
                <tr v-if="event.link_info_travel_country">
                  <th>Useful information to travel to this country</th>
                  <td><a :href="event.link_info_travel_country" target="_blank" rel="noopener noreferrer">{{ event.link_info_travel_country }}</a>
                  </td>
                </tr>
                <tr>
                  <th>Number of meals provided per day</th>
                  <td>{{ event.meals_per_day }}</td>
                </tr>
                <tr v-if="event.vegetarian">
                  <td colspan="2">
                    <div class="notification is-success">
                      This event is fully vegetarian!
                    </div>
                  </td>
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
                    <a v-if="event.budget" :href="event.budget" target="_blank" rel="noopener noreferrer">{{ event.budget }}</a>
                  </td>
                </tr>
                <tr>
                  <th>Program link</th>
                  <td>
                    <a v-if="event.programme" :href="event.programme" target="_blank" rel="noopener noreferrer">{{ event.programme }}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="notification is-info" v-if="event.status !== 'published'">
            <p><strong>This event is visible to EQAC and organizers only because it's not approved yet.</strong></p>
            <p>Once the event will be published, others would be able to access it.</p>
          </div>

          <div class="notification is-info" v-if="event.status === 'draft'">
            <p>
              This event is in the "draft" status. Once you have filled in all the fields,
              you can send it to EQAC approval.
            </p>
          </div>

          <div class="notification is-info" v-if="event.status === 'submitted'">
            <p>
              This event is under approval. Wait a little till EQAC approves it.
            </p>
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

    <b-loading is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { MglMap, MglMarker, MglPopup, MglNavigationControl } from 'vue-mapbox'
import constants from '../../constants'
import credentials from '../../credentials'
import TimezoneTooltip from '../../components/tooltips/TimezoneTooltip'
import PictureModal from './PictureModal.vue'

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
        zoom: 3
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
    openPictureModal () {
      this.$buefy.modal.open({
        component: PictureModal,
        hasModalCard: true,
        props: {
          event: this.event,
          permissions: this.permissions,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
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
      this.axios.delete(this.services['events'] + '/single/' + this.event.id).then(() => {
        this.$root.showInfo('Event is deleted.')
        this.$router.push({ name: 'oms.events.list.all' })
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

      this.axios.put(this.services['events'] + '/single/' + this.event.id + '/status', body).then(() => {
        this.$root.showInfo(`Event status is now ${newStatus}`)

        // Refetching the event to renew the permissions.
        return this.axios.get(this.services['events'] + '/single/' + this.$route.params.id)
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
        this.map.actions.jumpTo({
          center: this.event.locations[0].position,
          zoom: 10
        })
        return
      }

      const minCoords = {
        lat: Math.min(...this.event.locations.map(location => location.position.lat)),
        lng: Math.min(...this.event.locations.map(location => location.position.lng))
      }
      const maxCoords = {
        lat: Math.max(...this.event.locations.map(location => location.position.lat)),
        lng: Math.max(...this.event.locations.map(location => location.position.lng))
      }

      this.map.actions.fitBounds([minCoords, maxCoords], { padding: 50 })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['events'] + '/single/' + this.$route.params.id).then((response) => {
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

      this.$router.push({ name: 'oms.events.list.all' })
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
