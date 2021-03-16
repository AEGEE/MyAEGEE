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
          <div class="field is-grouped">
            <a :href="`mailto:${event.email}`" class="button is-fullwidth">
              <span>Mail organizers</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit_summeruniversity">
            <router-link v-if="can.approve_summeruniversity[event.type] || event.status === 'first draft' || event.status === 'first submission'" :to="{ name: 'oms.summeruniversity.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
            <router-link v-else :to="{ name: 'oms.summeruniversity.edit_second', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
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

          <!-- For SUCT & LOs: submit first approval (first approval -> second submission) -->
          <div class="field is-grouped" v-if="can.change_status.second_submission && event.status === 'first approval'">
            <a class="button is-fullwidth is-warning" @click="askChangeStatus('second submission')">
              <span>Submit event for second approval</span>
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
                    <div class="content" v-html="$options.filters.markdown(event.description)"></div>
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
                  <th>Starts <timezone-tooltip /></th>
                  <td>{{ event.starts | datetime }}</td>
                </tr>
                <tr>
                  <th>Starts in</th>
                  <td>{{ event.start_city }}</td>
                </tr>
                <tr>
                  <th>Ends <timezone-tooltip /></th>
                  <td>{{ event.ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Ends in</th>
                  <td>{{ event.end_city }}</td>
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
                <tr v-if="can.approve_summeruniversity[event.type]">
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

            <table class="table is-narrow" v-if="event.budget || event.programme_suct">
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
        starts: null,
        ends: null,
        head_image: null,
        status: 'published',
        optional_fee: null,
        optional_programme: null,
        accommodation_type: ''
      },
      eventTypes: constants.SUMMERUNIVERSITY_TYPES_NAMES,
      themeCategories: constants.SUMMERUNIVERSITY_THEMES_NAMES,
      accessToken: '',
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 8
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
        view_applications: false,
        apply: false,
        change_status: {
          first_draft: false,
          first_submission: false,
          first_approval: false,
          second_draft: false,
          second_submission: false,
          second_approval: false
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

      this.event.start_city = this.event.locations.find(location => location.start === true).name
      this.event.end_city = this.event.locations.find(location => location.end === true).name

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
