<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['summeruniversity-static'] + '/headimages/' + event.image">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped">
            <a :href="`mailto:${event.email}`" class="button is-fullwidth">
              <span>Mail organizers</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.list_applications">
            <router-link :to="{ name: 'oms.summeruniversity.participants', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View applications</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.apply">
            <router-link :to="{ name: 'oms.summeruniversity.apply', params: { id: event.url || event.id, application_id: 'me' } }" class="button is-primary is-fullwidth">
              <span>Apply</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_own_application">
            <router-link :to="{ name: 'oms.summeruniversity.apply', params: { id: event.url || event.id, application_id: 'me' } }" class="button is-fullwidth">
              <span>Manage application</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </router-link>
          </div>

          <!-- For SUCT & LOs: open Open Call period -->
          <div class="field is-grouped" v-if="can.edit_summeruniversity_open_call && event.open_call != true && event.available_spots != 0">
            <a class="button is-fullwidth is-warning" @click="askStartOpenCall()">
              <span>Start open call</span>
              <span class="icon"><font-awesome-icon icon="play" /></span>
            </a>
          </div>

          <!-- For SUCT & LOs: close Open Call period -->
          <div class="field is-grouped" v-if="can.edit_summeruniversity_open_call && event.open_call === true">
            <a class="button is-fullwidth is-danger" @click="askCloseOpenCall()">
              <span>Close open call</span>
              <span class="icon"><font-awesome-icon icon="stop" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit_summeruniversity">
            <a class="button is-fullwidth is-primary" data-cy="picture-change-link" @click="openPictureModal()">
              <span>Change picture</span>
              <span class="icon"><font-awesome-icon icon="camera" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit_summeruniversity">
            <!-- TODO: fix this, this is a hack because of covid submissions -->
            <!-- v-if="can.approve_summeruniversity[event.type] || event.status === 'first draft' || event.status === 'first submission'" -->
            <router-link :to="{ name: 'oms.summeruniversity.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
            <!-- <router-link v-else :to="{ name: 'oms.summeruniversity.edit_second', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link> -->
          </div>

          <!-- For SUCT: submit first draft (first draft -> first submission) -->
          <div class="field is-grouped" v-if="can.change_status.first_submission && event.status === 'first draft'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('first submission')">
              <span>Submit first draft</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For SUCT: submit second draft (second draft -> second submission) -->
          <div class="field is-grouped" v-if="can.change_status.second_submission && event.status === 'second draft'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('second submission')">
              <span>Submit second draft</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For SUCT: submit covid draft (covid draft -> covid submission) -->
          <div class="field is-grouped" v-if="can.change_status.covid_submission && event.status === 'covid draft'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('covid submission')">
              <span>Submit covid draft</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For SUCT & LOs: submit first approval (first approval -> second submission) -->
          <div class="field is-grouped" v-if="can.change_status.second_submission && event.status === 'first approval'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('second submission')">
              <span>Submit event for second approval</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For SUCT & LOs: submit second approval (second approval -> covid submission) -->
          <div class="field is-grouped" v-if="can.change_status.covid_submission && event.status === 'second approval'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('covid submission')">
              <span>Submit event for covid approval</span>
              <span class="icon"><font-awesome-icon icon="sign-in-alt" /></span>
            </a>
          </div>

          <!-- For SUCT: approve first submission (first submission -> first approval) -->
          <div class="field is-grouped" v-if="can.change_status.first_approval && event.status === 'first submission'">
            <a class="button is-fullwidth is-primary" @click="askChangeStatus('first approval')">
              <span>Approve first submission</span>
              <span class="icon"><font-awesome-icon icon="check" /></span>
            </a>
          </div>

          <!-- For SUCT: approve second submission (second submission -> second approval) -->
          <div class="field is-grouped" v-if="can.change_status.second_approval && event.status === 'second submission'">
            <a class="button is-fullwidth is-primary" @click="askChangeStatus('second approval')">
              <span>Approve second submission</span>
              <span class="icon"><font-awesome-icon icon="check" /></span>
            </a>
          </div>

          <!-- For SUCT: approve covid submission (covid submission -> covid approval) -->
          <div class="field is-grouped" v-if="can.change_status.covid_approval && event.status === 'covid submission'">
            <a class="button is-fullwidth is-primary" @click="askChangeStatus('covid approval')">
              <span>Approve covid submission</span>
              <span class="icon"><font-awesome-icon icon="check" /></span>
            </a>
          </div>

          <!-- For SUCT: reject first submission (first submission -> first draft) -->
          <div class="field is-grouped" v-if="can.change_status.first_draft && event.status === 'first submission'">
            <a class="button is-fullwidth is-danger" @click="askChangeStatus('first draft')">
              <span>Reject first submission</span>
              <span class="icon"><font-awesome-icon icon="times-circle" /></span>
            </a>
          </div>

          <!-- For SUCT: reject second submission (second submission -> second draft) -->
          <div class="field is-grouped" v-if="can.change_status.second_draft && event.status === 'second submission'">
            <a class="button is-fullwidth is-danger" @click="askChangeStatus('second draft')">
              <span>Reject second submission</span>
              <span class="icon"><font-awesome-icon icon="times-circle" /></span>
            </a>
          </div>

          <!-- For SUCT: reject covid submission (covid submission -> covid draft) -->
          <div class="field is-grouped" v-if="can.change_status.covid_draft && event.status === 'covid submission'">
            <a class="button is-fullwidth is-danger" @click="askChangeStatus('covid draft')">
              <span>Reject covid submission</span>
              <span class="icon"><font-awesome-icon icon="times-circle" /></span>
            </a>
          </div>

          <!-- For SUCT: publish minimal event -->
          <div class="field is-grouped" v-if="can.manage_summeruniversity[event.type] && event.published === 'none'">
            <a class="button is-fullwidth is-info" @click="askChangePublication('minimal')">
              <span>Publish minimal event</span>
              <span class="icon"><font-awesome-icon icon="globe" /></span>
            </a>
          </div>

          <!-- For SUCT: publish full event -->
          <div class="field is-grouped" v-if="can.manage_summeruniversity[event.type] && event.published === 'minimal'">
            <a class="button is-fullwidth is-info" @click="askChangePublication('full')">
              <span>Publish full event</span>
              <span class="icon"><font-awesome-icon icon="globe" /></span>
            </a>
          </div>

          <!-- For SUCT: publish covid event -->
          <div class="field is-grouped" v-if="can.manage_summeruniversity[event.type] && event.published === 'full'">
            <a class="button is-fullwidth is-info" @click="askChangePublication('covid')">
              <span>Publish covid event</span>
              <span class="icon"><font-awesome-icon icon="globe" /></span>
            </a>
          </div>

          <!-- For SUCT: unpublish event -->
          <div class="field is-grouped" v-if="can.manage_summeruniversity[event.type] && event.published !== 'none'">
            <a class="button is-fullwidth is-danger" @click="askChangePublication('none')">
              <span>Unpublish event</span>
              <span class="icon"><font-awesome-icon icon="pen" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.delete_summeruniversity">
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
                  <th>Event type</th>
                  <td>{{ eventTypes[event.type] }}</td>
                </tr>
                <tr>
                  <th>Theme category</th>
                  <td>{{ themeCategories[event.theme_category] }}</td>
                </tr>
                <tr>
                  <th>Theme</th>
                  <td>{{ event.theme }}</td>
                </tr>
                <tr>
                  <th>Max. participants</th>
                  <td>{{ event.max_participants }}</td>
                </tr>
                <tr>
                  <th>Application status</th>
                  <td>{{ event.application_status | capitalize }}</td>
                </tr>
                <tr v-if="event.application_status === 'open' && event.open_call != true">
                  <th>Application period ends <timezone-tooltip /></th>
                  <td>{{ event.application_ends | datetime }}</td>
                </tr>
                <tr v-if="event.open_call === true">
                  <th>Spots available</th>
                  <td>{{ event.available_spots }}</td>
                </tr>
                <tr>
                  <th>Starts <timezone-tooltip /></th>
                  <td>{{ event.starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Starts in</th>
                  <td v-if="event.startLocation">{{ event.startLocation }}</td>
                  <td v-if="!event.startLocation"><i>Not specified</i></td>
                </tr>
                <tr>
                  <th>Ends <timezone-tooltip /></th>
                  <td>{{ event.ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Ends in</th>
                  <td v-if="event.endLocation">{{ event.endLocation }}</td>
                  <td v-if="!event.endLocation"><i>Not specified</i></td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr v-if="event.optional_fee">
                  <th>Optional fee</th>
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
                <tr v-if="event.pax_description">
                  <th>Ideal participant</th>
                  <td>{{ event.pax_description }}</td>
                </tr>
                <tr v-if="event.pax_confirmation">
                  <th>Participant confirmation needed</th>
                  <td>{{ paxConfirmations[event.pax_confirmation] }}</td>
                </tr>
                <tr v-if="event.activities_list">
                  <th>List of activities</th>
                  <td>{{ event.activities_list }}</td>
                </tr>
                <tr v-if="event.special_equipment">
                  <th>Special equipment needed</th>
                  <td>{{ event.special_equipment }}</td>
                </tr>
                <tr v-if="event.course_level">
                  <th>Course level</th>
                  <td>{{ event.course_level | capitalize }}</td>
                </tr>
                <tr v-if="event.courses">
                  <th>Courses</th>
                  <td>{{ event.courses }}</td>
                </tr>
                <tr v-if="event.trainers">
                  <th>Trainers</th>
                  <td>{{ event.trainers }}</td>
                </tr>
                <tr v-if="event.university_support">
                  <th>Has university support?</th>
                  <td>{{ event.university_support | beautify }}</td>
                </tr>
                <tr v-if="event.covid_regulations">
                  <th>Where to find covid regulations</th>
                  <td>{{ event.covid_regulations }}</td>
                </tr>
                <tr v-if="event.cancellation_rules">
                  <th>Payment and cancellation rules</th>
                  <td>{{ event.cancellation_rules }}</td>
                </tr>
                <tr v-if="event.additional_regulation">
                  <th>SU specific regulations</th>
                  <td>{{ event.additional_regulation }}</td>
                </tr>
                <tr v-if="can.approve_summeruniversity[event.type]">
                  <th>Status</th>
                  <td>{{ event.status | capitalize }}</td>
                </tr>
                <tr v-if="can.manage_summeruniversity[event.type]">
                  <th>Publication status</th>
                  <td>{{ event.published | capitalize }}</td>
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
                <tr v-if="event.website">
                  <th>Website</th>
                  <td><a :href="event.website" target="_blank" rel="noopener noreferrer">{{ event.website }}</a></td>
                </tr>
                <tr v-if="event.social_media">
                  <th>Social media</th>
                  <td>
                    <ul>
                      <li v-for="social_medium in event.social_media" v-bind:key="social_medium"><a :href="social_medium.description" target="_blank" rel="noopener noreferrer">{{ social_medium.description }}</a></li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>

            <table class="table is-narrow" v-if="event.budget || event.programme_suct">
              <tbody>
                <tr>
                  <th>Budget link</th>
                  <td>
                    <a v-if="event.budget" :href="event.budget" target="_blank" rel="noopener noreferrer">{{ event.budget }}</a>
                  </td>
                </tr>
                <tr>
                  <th>Programme link</th>
                  <td>
                    <a v-if="event.programme_suct" :href="event.programme_suct" target="_blank" rel="noopener noreferrer">{{ event.programme_suct }}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="notification is-info" v-if="event.published === 'none'">
            <p><strong>This event is visible to SUCT and organizers only because it's not published yet.</strong></p>
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
                  <div class="mapbox-popup-custom">
                    <strong>{{ location.name }}</strong><br>
                    {{ location.description }}
                  </div>
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
        starts: null,
        ends: null,
        application_status: 'closed',
        application_ends: null,
        image: null,
        optional_fee: null,
        optional_programme: null,
        accommodation_type: ''
      },
      eventTypes: constants.SUMMERUNIVERSITY_TYPES_NAMES,
      themeCategories: constants.SUMMERUNIVERSITY_THEMES_NAMES,
      paxConfirmations: constants.SUMMERUNIVERSITY_PAX_CONFIRMATIONS,
      accessToken: '',
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      isLoading: false,
      can: {
        edit_summeruniversity: false,
        approve_summeruniversity: {
          pilot: false,
          regular: false
        },
        manage_summeruniversity: {
          pilot: false,
          regular: false
        },
        list_applications: false,
        apply: false,
        change_status: {
          first_draft: false,
          first_submission: false,
          first_approval: false,
          second_draft: false,
          second_submission: false,
          second_approval: false,
          covid_draft: false,
          covid_submission: false,
          covid_approval: false
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
      this.axios.delete(this.services['summeruniversity'] + '/single/' + this.event.id).then(() => {
        this.$root.showInfo('Event is deleted.')
        this.$router.push({ name: 'oms.summeruniversity.list.all' })
      }).catch((err) => this.$root.showError('Could not delete event', err))
    },
    askChangeStatus (newStatus) {
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
        this.$root.showError('Could not change event status', err)
      })
    },
    askChangePublication (newPublication) {
      this.$buefy.dialog.confirm({
        title: 'Change status',
        message: `Are you sure you want to <b>change this event publication to "${newPublication}"</b>?`,
        confirmText: 'Change publication',
        type: 'is-warning',
        hasIcon: true,
        onConfirm: () => this.changePublication(newPublication)
      })
    },
    changePublication (newPublication) {
      this.isLoading = true
      const body = { published: newPublication }

      this.axios.put(this.services['summeruniversity'] + '/single/' + this.event.id + '/published', body).then(() => {
        this.$root.showInfo(`Event publication is now ${newPublication}`)

        // Refetching the event to renew the permissions.
        return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id)
      }).then((response) => {
        this.event = response.data.data
        this.can = response.data.permissions
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not change event publication', err)
      })
    },
    askStartOpenCall () {
      this.$buefy.dialog.prompt({
        title: 'Start open call',
        message: 'Set maximum amount of participants',
        inputAttrs: {
          type: 'number',
          required: true,
          value: this.event.max_participants
        },
        trapFocus: true,
        onConfirm: (newMaxParticipants) => this.changeOpenCall(newMaxParticipants)
      })
    },
    askCloseOpenCall () {
      this.$buefy.dialog.confirm({
        message: 'Are you sure you want to <b>close</b> the open call.',
        confirmText: 'Close open call',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.changeOpenCall('close')
      })
    },
    changeOpenCall (openCall) {
      this.isLoading = true

      if (openCall === 'close') {
        openCall = { open_call: false }
      } else {
        openCall = { open_call: true, max_participants: openCall }
      }

      this.axios.put(this.services['summeruniversity'] + '/single/' + this.event.id + '/open_call', openCall).then(() => {
        this.$root.showInfo('Event open call is succesfully changed')

        // Refetching the event to renew the permissions.
        return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id)
      }).then((response) => {
        this.event = response.data.data
        this.can = response.data.permissions
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not change event open call', err)
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

    this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      const startLocation = this.event.locations.find(location => location.start === 'true') || this.event.locations.find(location => location.start === true)
      if (startLocation) {
        this.event.startLocation = startLocation.name
      }
      const endLocation = this.event.locations.find(location => location.end === 'true') || this.event.locations.find(location => location.end === true)
      if (endLocation) {
        this.event.endLocation = endLocation.name
      }

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
