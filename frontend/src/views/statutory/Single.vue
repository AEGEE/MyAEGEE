<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical statutory-event-logo">
        <article class="tile is-child is-primary">
          <p class="title is-hidden-tablet statutory-event-name">{{ event.name }}</p>
          <figure class="image">
            <img v-if="!event.image" src="/images/logo.png" />
            <img
              v-if="event.image"
              :src="services['statutory-static'] + event.image.frontend_path"
            />
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

          <section
            class="statutory-action-group"
            v-for="group in actionGroups"
            :key="group.id"
          >
            <p class="statutory-action-group-title">
              <span class="icon is-small"><font-awesome-icon :icon="group.icon" /></span>
              <span>{{ group.title }}</span>
            </p>
            <p class="statutory-action-group-help">{{ group.help }}</p>
            <div class="field" v-for="action in group.actions" :key="action.id">
              <router-link
                v-if="action.route"
                :to="{ name: action.route, params: action.params(actionContext) }"
                class="button is-fullwidth"
                :class="action.color && action.color(actionContext)"
              >
                <span>{{ actionLabel(action, actionContext) }}</span>
                <span class="icon"><font-awesome-icon :icon="action.icon" /></span>
              </router-link>
              <a
                v-else
                class="button is-fullwidth"
                :class="action.color && action.color(actionContext)"
                @click="runAction(action)"
              >
                <span>{{ action.label }}</span>
                <span class="icon"><font-awesome-icon :icon="action.icon" /></span>
              </a>
            </div>
          </section>
        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title is-hidden-mobile">{{ event.name }}</p>

          <div class="notification is-warning" v-if="activeEventApplicationBan">
            You are temporarily banned from submitting new event applications until {{ loginUser.event_application_ban.ban_until | datetime }}.
            Existing applications can still be managed and position applications remain available.
          </div>

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
                  <td>
                    <a
                      :href="event.booklet_folder"
                      class="has-word-break"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{
                      event.booklet_folder
                    }}</a>
                  </td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td>{{ constants.STATUTORY_TYPES_NAMES[event.type] }}</td>
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
                  <th>Organising body</th>
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
            <p>
              Please keep in mind that the dates are in your localtime, which is not necessarily
              CET.
            </p>
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

          <div
            class="tile"
            style="position: relative; height: 400px"
            v-if="this.event.locations.length > 0"
          >
            <MglMap
              id="map"
              accessToken=""
              :mapStyle="map.style"
              :zoom="map.zoom"
              :scrollZoom="false"
              @load="onMapLoaded"
              :center="map.center"
            >
              <MglNavigationControl position="top-right" />
              <MglMarker
                v-for="(location, index) in event.locations"
                v-bind:key="index"
                :coordinates="location.position"
                color="red"
              >
                <MglPopup>
                  <div class="mapbox-popup-custom">{{ location.name }}</div>
                </MglPopup>
              </MglMarker>
            </MglMap>
          </div>
        </div>
      </article>
    </div>

    <b-loading :is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MglMap, MglMarker, MglPopup, MglNavigationControl } from 'vue-mapbox'
import moment from 'moment'
import credentials from '../../credentials'
import PictureModal from './PictureModal.vue'
import constants from '../../constants.js'
import { actionLabel, groupActions, visibleActions } from './eventActions.js'

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
      constants,
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
      votings: [],
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
        manage_question_lines: false,
        manage_votings: false
      }
    }
  },
  methods: {
    actionLabel,
    runAction (action) {
      this[action.click.method](action.click.argument)
    },
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
      this.axios
        .put(this.services['statutory'] + '/events/' + this.event.id + '/status', {
          status: newStatus
        })
        .then(() => {
          this.$root.showInfo('Status is updated.')
          this.event.status = newStatus
        })
        .catch((err) => this.$root.showError('Could not update status', err))
    },
    loadVotings () {
      if (this.event.type !== 'agora') {
        return
      }

      // Only to show on the "Vote" button whether a voting is open; the button works without it.
      this.axios
        .get(this.services['statutory'] + '/events/' + this.event.id + '/votings')
        .then((response) => {
          this.votings = response.data.data
        })
        .catch(() => {})
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
        lat: Math.min(...this.event.locations.map((location) => location.position.lat)),
        lng: Math.min(...this.event.locations.map((location) => location.position.lng))
      }
      const maxCoords = {
        lat: Math.max(...this.event.locations.map((location) => location.position.lat)),
        lng: Math.max(...this.event.locations.map((location) => location.position.lng))
      }

      this.map.actions.fitBounds([minCoords, maxCoords], { padding: 50 })
    }
  },
  mounted () {
    this.isLoading = true
    this.axios
      .get(this.services['statutory'] + '/events/' + this.$route.params.id)
      .then((response) => {
        this.event = response.data.data
        this.can = response.data.data.permissions
        this.loadVotings()

        return this.axios.get(this.services['core'] + '/bodies/' + this.event.body_id)
      })
      .then((response) => {
        this.$set(this.event, 'body', response.data.data)

        if (this.map.actions) {
          this.centerMap()
        }

        this.isLoading = false
      })
      .catch((err) => {
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
      return (
        Object.keys(this.can.see_boardview).filter((key) => this.can.see_boardview[key]).length > 0
      )
    },
    canAccessMembersLists () {
      return (
        Object.keys(this.can.see_memberslist).filter((key) => this.can.see_memberslist[key])
          .length > 0
      )
    },
    actionContext () {
      return {
        event: this.event,
        can: this.can,
        canAccessBoardview: this.canAccessBoardview,
        canAccessMembersLists: this.canAccessMembersLists,
        openVotingsCount: this.openVotingsCount
      }
    },
    actionGroups () {
      return groupActions(visibleActions(this.actionContext))
    },
    openVotingsCount () {
      return this.votings.filter((voting) => voting.status === 'open').length
    },
    duringAgora () {
      return (
        this.event.type === 'agora'
        && moment().isBetween(this.event.starts, this.event.ends, null, '[]')
      )
    },
    activeEventApplicationBan () {
      return this.loginUser && this.loginUser.event_application_ban && new Date(this.loginUser.event_application_ban.ban_until) > new Date()
    }
  }
}
</script>

<style lang="scss">
.statutory-event-logo {
  flex: none;
}

@media screen and (max-width: 768px) {
  .statutory-event-logo .image img {
    display: block;
    margin: 0 auto;
    max-height: 9rem;
    width: auto;
  }
}

.statutory-action-group {
  & + & {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid #ededed;
  }

  .field:not(:last-child) {
    margin-bottom: 0.5rem;
  }
}

.statutory-action-group-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #434242;
}

.statutory-action-group-help {
  font-size: 0.8rem;
  color: #898989;
  margin: 0.15rem 0 0.6rem;
  line-height: 1.35;
}
</style>
