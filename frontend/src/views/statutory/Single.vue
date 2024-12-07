<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!event.image" src="/images/logo.png">
            <img v-if="event.image" :src="services['statutory-static'] + event.image.frontend_path">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <!-- <div class="field is-grouped" v-if="duringAgora">
            <a href="https://aegeeagora-streaming.westeurope.cloudapp.azure.com/" class="button is-danger is-fullwidth">
              <span>Watch live</span>
              <span class="icon"><font-awesome-icon icon="circle" /></span>
            </a>
          </div> -->

          <div class="field is-grouped" v-if="can.see_applications">
            <router-link :to="{ name: 'oms.statutory.applications', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>View applications</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_applications_incoming">
            <router-link :to="{ name: 'oms.statutory.incoming', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage incoming info</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_applications_juridical">
            <router-link :to="{ name: 'oms.statutory.juridical', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage juridical info</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_applications_network">
            <router-link :to="{ name: 'oms.statutory.network', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage members list status</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.export.all || can.export.incoming || can.export.openslides">
            <router-link :to="{ name: 'oms.statutory.applications.export', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Export participants info</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_plenaries || can.manage_plenaries">
            <router-link :to="{ name: 'oms.statutory.plenaries', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage/view plenaries</span>
              <span class="icon"><font-awesome-icon icon="check" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_participants_list">
            <router-link :to="{ name: 'oms.statutory.accepted', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Participants list</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="canAccessBoardview">
            <router-link :to="{ name: 'oms.statutory.boardview', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Board view</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="canAccessMembersLists && this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.memberslist.upload', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage members list</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_memberslist.global && this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.memberslist.list', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>See members lists</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_missing_memberslist.global && this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.memberslist.list.missing', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>See missing members lists</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_memberslist_without_fee.global && this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.memberslist.list.without_fee', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>See members lists without fee</span>
              <span class="icon"><font-awesome-icon icon="users" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.use_massmailer">
            <router-link :to="{ name: 'oms.statutory.massmailer', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Mass mailer</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.manage_candidates && this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.positions', params: { id: event.url || event.id, prefix: 'all' } }" class="button is-fullwidth">
              <span>Manage candidates</span>
              <span class="icon"><font-awesome-icon icon="vote-yea" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="this.event.type === 'agora'">
            <router-link :to="{ name: 'oms.statutory.positions', params: { id: event.url || event.id, prefix: 'approved' } }" class="button is-fullwidth">
              <span>View candidates</span>
              <span class="icon"><font-awesome-icon icon="vote-yea" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_questions || can.manage_question_lines">
            <router-link :to="{ name: 'oms.statutory.question_lines', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Question lines</span>
              <span class="icon"><font-awesome-icon icon="question" /></span>
            </router-link>
          </div>

          <div class="field is-grouped">
            <router-link :to="{ name: 'oms.statutory.applications.stats', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Applications stats</span>
              <span class="icon"><font-awesome-icon icon="table" /></span>
            </router-link>
          </div>

          <div class="field is-grouped">
            <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: 'me' } }" class="button is-warning is-fullwidth">
              <span>My application</span>
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
            <router-link :to="{ name: 'oms.statutory.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <a @click="askSwitchStatus('draft')" v-if="event.status === 'published'" class="button is-danger is-fullwidth">
              <span>Unpublish</span>
              <span class="icon"><font-awesome-icon icon="pen" /></span>
            </a>

            <a @click="askSwitchStatus('published')" v-if="event.status === 'draft'" class="button is-info is-fullwidth">
              <span>Publish</span>
              <span class="icon"><font-awesome-icon icon="globe" /></span>
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
                <tr v-if="event.booklet_folder">
                  <th>KMS page</th>
                  <td><a :href="event.booklet_folder" target="_blank" rel="noopener noreferrer">{{ event.booklet_folder }}</a></td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td v-if="event.type === 'agora'">Agora</td>
                  <td v-if="event.type === 'epm'">EPM</td>
                  <td v-if="event.type === 'spm'">SPM</td>
                </tr>
                <tr>
                  <th>Starts</th>
                  <td>{{ event.starts | date }}</td>
                </tr>
                <tr>
                  <th>Ends</th>
                  <td>{{ event.ends | date }}</td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr>
                  <th>Organizing body</th>
                  <td>
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: event.body_id } }">
                      {{ event.body ? event.body.name : 'Loading...' }}
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <div class="notification is-success" v-if="event.vegetarian">
        This event is fully vegetarian!
      </div>

      <article class="tile is-child">
        <div class="content">
          <p class="subtitle">Deadlines</p>
          <div class="content">
            <p>Please keep in mind that the dates are in your localtime, which is not necessarily CET.</p>
            <table class="table is-narrow">
              <thead>
                <tr>
                  <th />
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Application period</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.application_period_ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Board approval</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.board_approve_deadline | datetime }}</td>
                </tr>
                <tr>
                  <th>Participants list publishing</th>
                  <td colspan="2">{{ event.participants_list_publish_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Members list upload period</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.memberslist_submission_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Members list edit period</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.memberslist_edit_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Draft proposals</th>
                  <td colspan="2">{{ event.draft_proposal_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Final proposals</th>
                  <td colspan="2">{{ event.final_proposal_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Candidatures</th>
                  <td colspan="2">{{ event.candidature_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Documents publication</th>
                  <td colspan="2">{{ event.booklet_publication_deadline | datetime }}</td>
                </tr>
                <tr v-if="event.type === 'agora'">
                  <th>Updated documents publication</th>
                  <td colspan="2">{{ event.updated_booklet_publication_deadline | datetime }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="tile" style="position: relative; height: 400px" v-if="this.event.locations.length > 0">
            <MglMap
              id="map"
              accessToken=""
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
import moment from 'moment'
import credentials from '../../credentials'
import PictureModal from './PictureModal.vue'

export default {
  components: {
    MglMap,
    MglMarker,
    MglPopup,
    MglNavigationControl
  },
  name: 'SingleStatutory',
  data () {
    return {
      event: {
        name: '',
        description: '',
        id: null,
        url: null,
        body_id: null,
        body: null,
        status: null,
        type: '',
        image: null,
        locations: []
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      isLoading: false,
      can: {
        edit_event: false,
        change_event_status: false,
        delete_event: false,
        apply: false,
        see_boardview: {},
        see_participants_list: false,
        see_memberslist: {},
        see_missing_memberslist: {},
        see_memberslist_without_fee: {},
        export: false,
        see_questions: false,
        manage_question_lines: false
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
    askSwitchStatus (newStatus) {
      this.$buefy.dialog.confirm({
        title: 'Switching status',
        message: `Are you sure you want to <b>switch this event's status to "${newStatus}"</b>?`,
        confirmText: 'Switch status',
        type: 'is-info',
        hasIcon: true,
        onConfirm: () => this.switchStatus(newStatus)
      })
    },
    switchStatus (newStatus) {
      this.axios.put(this.services['statutory'] + '/events/' + this.event.id + '/status', { status: newStatus }).then(() => {
        this.$root.showInfo('Status is updated.')
        this.event.status = newStatus
      }).catch((err) => this.$root.showError('Could not update status', err))
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
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      return this.axios.get(this.services['core'] + '/bodies/' + this.event.body_id)
    }).then((response) => {
      this.event.body = response.data.data

      if (this.map.actions) {
        this.centerMap()
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    canAccessBoardview () {
      return Object.keys(this.can.see_boardview)
        .filter(key => this.can.see_boardview[key])
        .length > 0
    },
    canAccessMembersLists () {
      return Object.keys(this.can.see_memberslist)
        .filter(key => this.can.see_memberslist[key])
        .length > 0
    },
    duringAgora () {
      return this.event.type === 'agora' && moment().isBetween(this.event.starts, this.event.ends, null, '[]')
    }
  }
}
</script>
