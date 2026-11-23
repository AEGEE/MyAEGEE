<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveEvent()">
        <div class="notification is-info">
          <div class="content">
            <p>If you want to upload an image, please do it from the event page after creating the event.</p>
          </div>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-name">Title <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="statutory-event-name" class="input" type="text" required v-model="event.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-description">Description <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea id="statutory-event-description" class="textarea" placeholder="e.g. Hello world" required v-model="event.description" />
          </div>
          <p class="label">Preview <MarkdownTooltip /></p>
          <div class="content">
            <span v-html="$options.filters.markdown(event.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-url">Event URL <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/statutory/</a>
              </div>
              <div class="control">
                <input id="statutory-event-url" class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label" for="statutory-event-type">Event type <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="select">
              <select id="statutory-event-type" v-model="event.type">
                <option value="agora">Agora</option>
                <option value="epm">EPM</option>
                <option value="spm">SPM</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ')}}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          Please select the event type wisely, as it will influence the event's workflow. <strong>It can't be changed later.</strong>
        </div>

        <div class="field" v-if="!$route.params.id">
          <p class="label">Is the event going to be fully vegetarian?</p>
          <div class="control">
            <label class="checkbox">
              <input type="checkbox" v-model="event.vegetarian" />
              Yes, the event will be without any meat
            </label>
          </div>
        </div>

        <div class="notification is-success" v-if="!$route.params.id">
          Consider if you want to make the event fully vegetarian / vegan! <strong>It can't be changed later.</strong>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-booklet-folder">Link to KMS page <URLTooltip /></label>
          <div class="control">
            <input id="statutory-event-booklet-folder" class="input" type="url" v-model="event.booklet_folder" />
          </div>
          <p class="help is-danger" v-if="errors.booklet_folder">{{ errors.booklet_folder.join(', ') }}</p>
        </div>

        <timezone-notification />

        <div class="field">
          <label class="label" for="statutory-event-starts">Event start date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-starts"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-ends">Event end date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-ends"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-application-period-starts">Application period starts <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-application-period-starts"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.application_period_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_starts">{{ errors.application_period_starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-application-period-ends">Application period ends <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-application-period-ends"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.application_period_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_ends">{{ errors.application_period_ends.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-board-approve-deadline">Board approve deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-board-approve-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.board_approve_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.board_approve_deadline">{{ errors.board_approve_deadline.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-participants-list-publish-deadline">Participants list publish deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-participants-list-publish-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.participants_list_publish_deadline" />
          </div>
          <p class="help is-warning" v-if="participantsListPublishBeforeBoardApprove">Suggested: keep participants list publish deadline after board approve deadline.</p>
          <p class="help is-danger" v-if="errors.participants_list_publish_deadline">{{ errors.participants_list_publish_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-memberslist-submission-deadline">Members list submission deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-memberslist-submission-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.memberslist_submission_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.memberslist_submission_deadline">{{ errors.memberslist_submission_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-draft-proposal-deadline">Draft proposals deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-draft-proposal-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.draft_proposal_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.draft_proposal_deadline">{{ errors.draft_proposal_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-final-proposal-deadline">Final proposals deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-final-proposal-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.final_proposal_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.final_proposal_deadline">{{ errors.final_proposal_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-candidature-deadline">Candidatures deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-candidature-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.candidature_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.candidature_deadline">{{ errors.candidature_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-booklet-publication-deadline">Documents publication deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-booklet-publication-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.booklet_publication_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.booklet_publication_deadline">{{ errors.booklet_publication_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label" for="statutory-event-updated-booklet-publication-deadline">Updated documents publication deadline <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              id="statutory-event-updated-booklet-publication-deadline"
              placeholder="Select date"
              class="input"
              aria-required="true"
              :config="dateConfig"
              v-model="dates.updated_booklet_publication_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.updated_booklet_publication_deadline">{{ errors.updated_booklet_publication_deadline.join(', ') }}</p>
        </div>

        <div class="tile is-child">
          <div class="field">
            <label class="label" for="statutory-event-body">Organising body <span class="has-text-danger">*</span></label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  id="statutory-event-body"
                  v-model="autoComplete.bodies.name"
                  :data="autoComplete.bodies.values"
                  open-on-focus="true"
                  :loading="autoComplete.bodies.loading"
                  @input="query => fetchBodies(query)"
                  @select="body => { event.body_id = body.id; $set(event, 'body', body); }">
                  <template slot-scope="props">
                    <div class="media">
                      <div class="media-content">
                        {{ props.option.name }}
                        <br>
                        <small> {{ props.option.description }} </small>
                      </div>
                    </div>
                  </template>
                </b-autocomplete>
                <p class="control">
                  <button
                    type="button"
                    class="button is-danger"
                    @click="body => { $set(event, 'body_id', null); $delete(event, 'body') }"
                    v-if="event.body">{{ event.body.name }} (Click to unset)</button>
                  <a class="button is-static" v-if="!event.body">Not set.</a>
                </p>
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.body_id">{{ errors.body_id.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="statutory-event-fee">Fee <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input id="statutory-event-fee" class="input" type="number" v-model.number="event.fee" required min="0" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.join(', ') }}</p>
        </div>

        <hr />

        <h2 class="subtitle is-fullwidth has-text-centered">Questions <span class="has-text-danger">*</span></h2>

        <table class="table is-fullwidth is-narrowed">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th>Required (works for text and string)?</th>
              <th>Values (for select)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, index) in event.questions" v-bind:key="index">
              <td>
                <input class="input" type="text" required v-model="event.questions[index].description" :aria-label="'Question ' + (index + 1) + ' description'" />
              </td>
              <td>
                <div class="select">
                  <select v-model="event.questions[index].type" @change="nullifyOrDeleteSelect(index)" :aria-label="'Question ' + (index + 1) + ' type'">
                    <option value="string">String</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="select">Select</option>
                  </select>
                </div>
              </td>
              <td>
                <input type="checkbox" v-model="event.questions[index].required" :aria-label="'Question ' + (index + 1) + ' required'" />
              </td>
              <td>
                <input-tag
                  v-if="event.questions[index].type === 'select'"
                  v-model="event.questions[index].values"
                  :placeholder="'Question ' + (index + 1) + ' values'"
                  :before-adding="value => value.trim()" />
              </td>
              <td>
                <button type="button" class="button is-danger" @click="deleteQuestion(index)" :aria-label="'Delete question ' + (index + 1)">Delete question</button>
              </td>
            </tr>
            <tr v-if="event.questions.length === 0">
              <td colspan="5">No questions are set.</td>
            </tr>
          </tbody>
        </table>

        <div class="notification is-danger" v-if="errors.questions">
          <div class="content">
            Could not create/edit event because of these reasons:
            <ul>
              <li v-for="(error, index) in errors.questions" v-bind:key="index">{{ error }}</li>
            </ul>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <button type="button" class="button is-primary" @click="addQuestion()">Add new question</button>
          </div>
        </div>

        <h2 class="subtitle is-fullwidth has-text-centered">Locations</h2>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You can add a location and drag it on the map to the desired point.</p>
            <p>The location name would be displayed as a map marker popup.</p>
          </div>
        </div>

        <div class="tile" style="position: relative; height: 400px">
          <MglMap
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
              color="red"
              :draggable="true"
              @dragend="setMarkerPosition($event, index)" />
          </MglMap>
        </div>

        <table class="table is-narrowed is-stripped is-fullwidth">
          <thead>
            <tr>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(marker, index) in event.locations" v-bind:key="index">
              <td>{{ marker.position.lat }}</td>
              <td>{{ marker.position.lng }}</td>
              <td>
                <input type="text" class="input" required v-model="marker.name" :aria-label="'Location ' + (index + 1) + ' name'" />
              </td>
              <td>
                <button type="button" class="button is-danger" @click="deleteLocation(index)" :aria-label="'Delete location ' + (index + 1)">Delete location</button>
              </td>
            </tr>
            <tr v-if="event.locations.length === 0">
              <td colspan="4">No locations added.</td>
            </tr>
          </tbody>
        </table>

        <p class="help is-danger" v-if="errors.locations">{{ errors.locations.join(', ') }}</p>

        <div class="field">
          <div class="control">
            <button type="button" class="button is-primary" @click="addLocation()">Add new location</button>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>

      <b-loading is-full-page="false" :active.sync="isLoading" />
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'mapbox-gl/dist/mapbox-gl.css'
import 'flatpickr/dist/flatpickr.css'
import flatPickr from 'vue-flatpickr-component'
import InputTag from 'vue-input-tag'
import moment from 'moment'
import { MglMap, MglMarker, MglNavigationControl } from 'vue-mapbox'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'
import credentials from '../../credentials'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'
import URLTooltip from '../../components/tooltips/URLTooltip'

// A date picker that was emptied gives '': that date is not set.
const toDate = (value) => (value ? new Date(value) : null)

export default {
  name: 'EditStatutory',
  components: {
    flatPickr,
    InputTag,
    TimezoneNotification,
    MglMap,
    MglMarker,
    MglNavigationControl,
    MarkdownTooltip,
    URLTooltip
  },
  data () {
    return {
      event: {
        name: null,
        description: '', // so it won't be null and marked() would not error
        id: null,
        url: null,
        type: 'agora',
        vegetarian: false,
        body_id: null,
        application_period_starts: null,
        application_period_ends: null,
        board_approve_deadline: null,
        participants_list_publish_deadline: null,
        memberslist_submission_deadline: null,
        draft_proposal_deadline: null,
        final_proposal_deadline: null,
        candidature_deadline: null,
        booklet_publication_deadline: null,
        updated_booklet_publication_deadline: null,
        questions: [],
        locations: [],
        fee: null,
        starts: null,
        ends: null,
        booklet_folder: null
      },
      dates: {
        application_period_starts: null,
        application_period_ends: null,
        board_approve_deadline: null,
        participants_list_publish_deadline: null,
        memberslist_submission_deadline: null,
        draft_proposal_deadline: null,
        final_proposal_deadline: null,
        candidature_deadline: null,
        booklet_publication_deadline: null,
        updated_booklet_publication_deadline: null,
        starts: null,
        ends: null
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      autoComplete: {
        bodies: { name: '', values: [], loading: false }
      },
      dateConfig: {
        enableTime: true,
        time_24hr: true,
        // Typed dates are accepted, and phones get the same picker.
        allowInput: true,
        disableMobile: true
      },
      errors: {},
      isLoading: false,
      savedStarts: null,
      isSaving: false
    }
  },
  methods: {
    fetchBodies (query) {
      if (!query) return

      this.autoComplete.bodies.values = []
      this.autoComplete.bodies.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/bodies', {
        cancelToken: this.token.token,
        params: { query }
      }).then((response) => {
        this.autoComplete.bodies.values = response.data.data
        this.autoComplete.bodies.loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete.bodies.loading = false
        this.$root.showError('Could not fetch bodies', err)
      })
    },
    nullifyOrDeleteSelect (index) {
      if (this.event.questions[index].type === 'select') {
        this.$set(this.event.questions[index], 'values', [])
      } else {
        this.$delete(this.event.questions[index], 'values')
      }
    },
    addQuestion () {
      this.event.questions.push({
        description: '',
        required: true,
        type: 'string'
      })
    },
    deleteQuestion (index) {
      this.event.questions.splice(index, 1)
    },
    addLocation () {
      this.event.locations.push({
        name: '',
        position: {
          lat: this.map.center.lat,
          lng: this.map.center.lng
        }
      })
    },
    deleteLocation (index) {
      this.event.locations.splice(index, 1)
    },
    setMarkerPosition (event, index) {
      const newCoords = event.marker.getLngLat()

      this.event.locations[index].position.lat = newCoords.lat
      this.event.locations[index].position.lng = newCoords.lng
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
    },
    saveEvent () {
      if (this.event.questions.length === 0) {
        return this.$root.showError('Please set at least 1 application question.')
      }

      if (!this.event.starts) {
        return this.$root.showError('Please set the date when the event will start.')
      }

      if (!this.event.ends) {
        return this.$root.showError('Please set the date when the event will end.')
      }

      if (!this.event.application_period_starts) {
        return this.$root.showError('Please set the date when applications period will start.')
      }

      if (!this.event.application_period_ends) {
        return this.$root.showError('Please set the date when applications period will end.')
      }

      if (!this.event.board_approve_deadline) {
        return this.$root.showError('Please set the board approve deadline.')
      }

      if (!this.event.participants_list_publish_deadline) {
        return this.$root.showError('Please set the participants list publish deadline.')
      }

      if (this.event.type === 'agora' && !this.event.memberslist_submission_deadline) {
        return this.$root.showError('Please set the members list submission deadline.')
      } if (this.event.type !== 'agora') {
        this.event.memberslist_submission_deadline = null
      }

      if (this.event.type === 'agora' && !this.event.draft_proposal_deadline) {
        return this.$root.showError('Please set the draft proposal deadline.')
      } if (this.event.type !== 'agora') {
        this.event.draft_proposal_deadline = null
      }

      if (this.event.type === 'agora' && !this.event.final_proposal_deadline) {
        return this.$root.showError('Please set the final proposal deadline.')
      } if (this.event.type !== 'agora') {
        this.event.final_proposal_deadline = null
      }

      if (this.event.type === 'agora' && !this.event.candidature_deadline) {
        return this.$root.showError('Please set the candidature deadline.')
      } if (this.event.type !== 'agora') {
        this.event.candidature_deadline = null
      }

      if (this.event.type === 'agora' && !this.event.booklet_publication_deadline) {
        return this.$root.showError('Please set the documents publication deadline.')
      } if (this.event.type !== 'agora') {
        this.event.booklet_publication_deadline = null
      }

      if (this.event.type === 'agora' && !this.event.updated_booklet_publication_deadline) {
        return this.$root.showError('Please set the updated documents publication deadline.')
      } if (this.event.type !== 'agora') {
        this.event.updated_booklet_publication_deadline = null
      }

      if (!this.event.body_id) {
        return this.$root.showError('Please select a body.')
      }

      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.services['statutory'] + '/events/' + this.$route.params.id, this.event)
        : this.axios.post(this.services['statutory'], this.event)

      promise.then(() => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.statutory.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) { // validation errors
          if (!err.response.data.errors) {
            return this.$root.showError('Some of the event data is invalid', err)
          }

          this.errors = err.response.data.errors
          return this.$root.showError('Some of the event data is invalid.')
        }

        this.$root.showError('Could not save event', err)
      })
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
    }),
    participantsListPublishBeforeBoardApprove () {
      if (!this.dates.participants_list_publish_deadline || !this.dates.board_approve_deadline) {
        return false
      }

      return moment(this.dates.participants_list_publish_deadline).isSameOrBefore(this.dates.board_approve_deadline)
    }
  },
  watch: {
    'event.name': function (newName) {
      if (!this.$route.params.id) {
        this.event.url = this.$root.sluggify(newName)
      }
    },
    'dates.application_period_starts': function (newDate) {
      this.event.application_period_starts = toDate(newDate)
    },
    'dates.application_period_ends': function (newDate) {
      this.event.application_period_ends = toDate(newDate)
    },
    'dates.board_approve_deadline': function (newDate) {
      this.event.board_approve_deadline = toDate(newDate)

      if (newDate && !this.dates.participants_list_publish_deadline) {
        this.dates.participants_list_publish_deadline = moment(newDate).add(1, 'day').toDate()
      }
    },
    'dates.participants_list_publish_deadline': function (newDate) {
      this.event.participants_list_publish_deadline = toDate(newDate)
    },
    'dates.memberslist_submission_deadline': function (newDate) {
      this.event.memberslist_submission_deadline = toDate(newDate)
    },
    'dates.starts': function (newDate) {
      this.event.starts = toDate(newDate)

      // Keep the saved deadlines when an existing event is loaded (also when the
      // date picker writes the same start date back), or when the start is emptied;
      // only suggest them for new events or when the start date is changed.
      if (!newDate) {
        return
      }

      if (this.$route.params.id && this.savedStarts && moment(newDate).isSame(this.savedStarts, 'minute')) {
        return
      }

      this.dates.draft_proposal_deadline = moment(this.dates.starts).subtract(45, 'days').endOf('day').second(0)
        .toDate()
      this.dates.final_proposal_deadline = moment(this.dates.starts).subtract(1, 'month').endOf('day').second(0)
        .toDate()
      this.dates.candidature_deadline = moment(this.dates.starts).subtract(2, 'week').endOf('day').second(0)
        .toDate()
      this.dates.booklet_publication_deadline = moment(this.dates.starts).subtract(2, 'week').endOf('day').second(0)
        .toDate()
      this.dates.updated_booklet_publication_deadline = moment(this.dates.starts).subtract(5, 'days').endOf('day').second(0)
        .toDate()
    },
    'dates.ends': function (newDate) {
      this.event.ends = toDate(newDate)
    },
    'dates.draft_proposal_deadline': function (newDate) {
      this.event.draft_proposal_deadline = toDate(newDate)
    },
    'dates.final_proposal_deadline': function (newDate) {
      this.event.final_proposal_deadline = toDate(newDate)
    },
    'dates.candidature_deadline': function (newDate) {
      this.event.candidature_deadline = toDate(newDate)
    },
    'dates.booklet_publication_deadline': function (newDate) {
      this.event.booklet_publication_deadline = toDate(newDate)
    },
    'dates.updated_booklet_publication_deadline': function (newDate) {
      this.event.updated_booklet_publication_deadline = toDate(newDate)
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      this.savedStarts = new Date(this.event.starts)
      this.dates.starts = this.event.starts = new Date(this.event.starts)
      this.dates.ends = this.event.ends = new Date(this.event.ends)
      this.dates.application_period_starts = this.event.application_period_starts = new Date(this.event.application_period_starts)
      this.dates.application_period_ends = this.event.application_period_ends = new Date(this.event.application_period_ends)
      this.dates.board_approve_deadline = this.event.board_approve_deadline = new Date(this.event.board_approve_deadline)
      this.dates.participants_list_publish_deadline = this.event.participants_list_publish_deadline = new Date(this.event.participants_list_publish_deadline)
      this.dates.memberslist_submission_deadline = this.event.memberslist_submission_deadline = new Date(this.event.memberslist_submission_deadline)
      this.dates.draft_proposal_deadline = this.event.draft_proposal_deadline = new Date(this.event.draft_proposal_deadline)
      this.dates.final_proposal_deadline = this.event.final_proposal_deadline = new Date(this.event.final_proposal_deadline)
      this.dates.candidature_deadline = this.event.candidature_deadline = new Date(this.event.candidature_deadline)
      this.dates.booklet_publication_deadline = this.event.booklet_publication_deadline = new Date(this.event.booklet_publication_deadline)
      this.dates.updated_booklet_publication_deadline = this.event.updated_booklet_publication_deadline = new Date(this.event.updated_booklet_publication_deadline)

      return this.axios.get(this.services['core'] + '/bodies/' + this.event.body_id)
    }).then((response) => {
      this.$set(this.event, 'body', response.data.data)

      if (this.map.actions) {
        this.centerMap()
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
