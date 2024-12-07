<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <div class="subtitle">Update event logo</div>

      <div class="field is-grouped">
        <div class="control">
          <div class="file has-name">
            <label class="file-label">
              <input class="file-input" type="file" name="resume" @change="setFile($event)">
              <span class="file-cta">
                <span class="file-icon">
                  <font-awesome-icon icon="upload" />
                </span>
                <span class="file-label">
                  Choose a file
                </span>
              </span>
              <span class="file-name">
                {{ file ? file.name : 'Not set.' }}
              </span>
            </label>
          </div>
        </div>

        <div class="control">
          <a class="button is-info" :disabled="!file" @click="updateImage()">Upload!</a>
        </div>
      </div>

      <hr />

      <form @submit.prevent="saveEvent()">
        <div class="notification is-info">
          <div class="content">
            <p>If you have any questions, please refer to the <a href="https://drive.google.com/drive/folders/1D2OB5gGmyAScf-ITFK1URJ8ZuIZlWCbX" target="_blank" rel="noopener noreferrer">booklets</a> first.</p>
            <p><i>You need a AEGEE Google Workspace account to be able to see the booklets. In case you don't have one,
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/248348673/Requesting+a+Gsuite+account+for+yourself" target="blank">
                here's how to request it
              </a>.</i></p>
            <p><strong>Once the event is saved for the second submission, you are not able to edit information yourself.</strong> So please check everything twice.</p>
            <p>If you will need the event info to be changed after saving, please contact <a href="mailto:suct@aegee.eu">SUCT</a>.</p>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Event details</div>
        <hr />

        <div class="field" v-if="can.editEventType">
          <label class="label">Event type <span class="has-text-danger">*</span></label>
          <div class="select">
            <select v-model="event.type">
              <option v-for="(name, type) in eventTypes" v-bind:key="type" v-bind:value="type">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ') }}</p>
        </div>

        <div class="field" v-if="can.editSeason">
          <label class="label">Season <span class="has-text-danger">*</span></label>
          <div class="select">
            <select v-model="season">
              <option value="2021">2021</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option selected value="2024">2024</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.season">{{ errors.season.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="checkbox">
            <strong>Our SU has university support </strong>
            <input type="checkbox" v-model="event.university_support" />
          </label>
          <p class="help is-danger" v-if="errors.university_support">{{ errors.university_support.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">List of activities <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea class="textarea" placeholder="List the main activities here so potential participants know what they can expect from your SU." required v-model="event.activities_list" />
          </div>
          <p class="help is-danger" v-if="errors.activities_list">{{ errors.activities_list.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Course level <span class="has-text-danger">*</span></label>
          <div class="select">
            <select v-model="event.course_level" required>
              <option v-for="(name, course_level) in courseLevels" v-bind:key="course_level" v-bind:value="course_level">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.course_level">{{ errors.course_level.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Courses</label>
          <div class="control">
            <textarea class="textarea" placeholder="List your courses here." v-model="event.courses" />
          </div>
          <p class="help is-danger" v-if="errors.courses">{{ errors.courses.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Trainers <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea class="textarea" placeholder="Do not provide names, just explain if they are from a body, experienced members of your local, etc." required v-model="event.trainers" />
          </div>
          <p class="help is-danger" v-if="errors.trainers">{{ errors.trainers.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Contact information & promotion</div>
        <hr />

        <div class="field">
          <label class="label">Website <URLTooltip /></label>
          <div class="control">
            <input class="input" type="url" v-model="event.website" />
          </div>
          <p class="help is-danger" v-if="errors.website">{{ errors.website.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Social media <URLTooltip /></label>
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(social_media, index) in event.social_media" v-bind:key="index">
                <td>
                  <input class="input" type="url" required v-model="event.social_media[index].description" />
                </td>
                <td>
                  <a class="button is-danger" @click="deleteSocialMedia(index)">Delete</a>
                </td>
                <td v-if="event.social_media.length < 3">
                  <a class="button is-primary" @click="addSocialMedia()">+</a>
                </td>
              </tr>
              <tr colspan="3" v-if="event.social_media.length === 0">
                <td>No social media links are set.</td>
              </tr>
              <tr colspan="3" v-if="event.social_media.length >= 3">
                <td><strong>At most 3 social media links can be set.</strong></td>
              </tr>
              <tr colspan="3" v-if="event.social_media.length === 0">
                <td>
                  <a class="button is-primary" @click="addSocialMedia()">Add social media link</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.social_media">{{ errors.social_media.message }}</p>

        <div class="field">
          <div class="notification is-warning">
            <div class="content">
              <p><strong>COPYRIGHT:</strong> Make sure you own the rights to the photos. Use photos of previous events made by your own local.
                Or use photos from <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer">pixabay.com</a> or <a href="https://pexels.com" target="_blank" rel="noopener noreferrer">pexels.com</a> for example (free to use photos).</p>
            </div>
          </div>
          <label class="label">Photos <span class="has-text-danger">*</span> <URLTooltip /></label>
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(photos, index) in event.photos" v-bind:key="index">
                <td>
                  <input class="input" type="url" required v-model="event.photos[index].description" />
                </td>
                <td>
                  <a class="button is-danger" @click="deletePhotos(index)">Delete</a>
                </td>
                <td v-if="event.photos.length < 6">
                  <a class="button is-primary" @click="addPhotos()">+</a>
                </td>
              </tr>
              <tr colspan="3" v-if="event.photos.length === 0">
                <td>No links to photos are set.</td>
              </tr>
              <tr colspan="3" v-if="event.photos.length >= 6">
                <td><strong>At most 6 links to photos can be set.</strong></td>
              </tr>
              <tr colspan="3" v-if="event.photos.length === 0">
                <td>
                  <a class="button is-primary" @click="addPhotos()">Add link to photo</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.photos">{{ errors.photos.message }}</p>

        <div class="field">
          <label class="label">Video <URLTooltip /></label>
          <div class="control">
            <input class="input" type="url" v-model="event.video" />
          </div>
          <p class="help is-danger" v-if="errors.video">{{ errors.video.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Organizers <span class="has-text-danger">*</span></div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>The user creating the event automatically becomes an organizer.</p>
            <p>People who are not listed as organizers won't be able to see and manage event applications, even if they are the board members.</p>
            <p><strong>You can only add people from the organizing bodies.</strong></p>
            <p>Please add at least:<br />
              - 1 main coordinator per organizing body<br />
              - 1 content manager<br />
              - 1 treasurer<br />
              - 1 incoming responsible</p>
          </div>
        </div>

        <div>
          <b-table
            :data="event.organizers"
            :loading="isLoading">
            <b-table-column field="first_name" label="First and last name" sortable v-slot="props">
              <router-link target="_blank" rel="noopener noreferrer" :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                {{ props.row.first_name }} {{ props.row.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="role" label="Role" v-slot="props">
              <div class="select">
                <select v-model="props.row.role">
                  <option v-for="(name, role) in roles" v-bind:key="role" v-bind:value="role">{{ name }}</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column label="Delete" v-slot="props">
              <button class="button is-small is-danger" v-if="!props.row.disableEdit" @click="deleteOrganizer(props.index)">
                Delete
              </button>
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>

          <div class="field">
            <label class="label">Add organizer</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  v-model="autoComplete.members.name"
                  :data="autoComplete.members.values"
                  open-on-focus="true"
                  :loading="autoComplete.members.loading"
                  @input="query => fetchMembers(query)"
                  @select="organizer => addOrganizer(organizer)">
                  <template slot-scope="props">
                    <div class="media">
                      <div class="media-content">
                        {{ props.option.first_name }}
                        <br>
                        <small> {{ props.option.last_name }} </small>
                      </div>
                    </div>
                  </template>
                </b-autocomplete>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Locations <span class="has-text-danger">*</span></div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You can add a location and drag it on the map to the desired point.</p>
            <p>The location name would be displayed as a map marker popup.</p>
            <p>Please mention the name of the city in the 'Name' field, and mention the city the SU starts in and the city the SU ends in.</p>
          </div>
        </div>

        <div class="tile" style="position: relative; height: 400px">
          <MglMap
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
              <th>Description</th>
              <th>Starting city</th>
              <th>Ending city</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(marker, index) in event.locations" v-bind:key="index">
              <td>{{ marker.position.lat }}</td>
              <td>{{ marker.position.lng }}</td>
              <td>
                <input type="text" class="input" required v-model="marker.name" />
              </td>
              <td>
                <textarea class="textarea" v-model="marker.description" />
              </td>
              <td>
                <input type="radio" name="start_loc" v-model="marker.start" value=true />
              </td>
              <td>
                <input type="radio" name="end_loc" v-model="marker.end" value=true />
              </td>
              <td>
                <button class="button is-danger" @click="deleteLocation(index)">Delete location</button>
              </td>
            </tr>
            <tr colspan="5" v-if="event.locations.length === 0">
              <td>No locations added.</td>
            </tr>
          </tbody>
        </table>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addLocation()">Add new location</a>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Participant info</div>
        <hr />

        <div class="field">
          <label class="label">Confirmation needed <span class="has-text-danger">*</span></label>
          <div class="select">
            <select v-model="event.pax_confirmation">
              <option v-for="(name, pax_confirmation) in paxConfirmations" v-bind:key="pax_confirmation" v-bind:value="pax_confirmation">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.pax_confirmation">{{ errors.pax_confirmation.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Ideal participant <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea class="textarea" placeholder="Explain what should participants of your SU look like." required v-model="event.pax_description" />
          </div>
          <p class="help is-danger" v-if="errors.pax_description">{{ errors.pax_description.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Special equipment needed</label>
          <div class="control">
            <textarea class="textarea" placeholder="Explain if participants need special equipment for your SU." v-model="event.special_equipment" />
          </div>
          <p class="help is-danger" v-if="errors.special_equipment">{{ errors.special_equipment.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Questions</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>If you have any specific questions relevant for the applicants for your SU, you can add them here.</p>
          </div>
        </div>
        <div class="field">
          <table class="table is-narrowed">
            <tbody>
              <tr v-for="(questions, index) in event.questions" v-bind:key="index">
                <td>
                  <input class="input" type="text" required v-model="event.questions[index].description" />
                </td>
                <td>
                  <a class="button is-danger" @click="deleteQuestion(index)">Delete</a>
                </td>
                <td v-if="event.questions.length < 3">
                  <a class="button is-primary" @click="addQuestion()">+</a>
                </td>
              </tr>
              <tr colspan="3" v-if="event.questions.length === 0">
                <td>No questions are set.</td>
              </tr>
              <tr colspan="3" v-if="event.questions.length >= 3">
                <td><strong>At most 3 questions can be set.</strong></td>
              </tr>
              <tr colspan="3" v-if="event.questions.length === 0">
                <td>
                  <a class="button is-primary" @click="addQuestion()">Add question</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="help is-danger" v-if="errors.questions">{{ errors.questions.message }}</p>

        <div class="subtitle is-fullwidth has-text-centered">SUCT approval fields</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>These fields are visible to SUCT only.</p>
            <p>Please provide the link to Google spreadsheets for the event programme and budget. Be sure that SUCT can open it.</p>
            <p><a href="https://docs.google.com/spreadsheets/u/1/?ftv=1&tgif=d" target="_blank" rel="noopener noreferrer">
              You can take the templates for the budget and programme here.
            </a></p>
            <p><i>
              Note: in case you cannot see AEGEE templates at the link above, try switching to AEGEE Google Workspace account.
              In case you don't have one,
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/248348673/Requesting+a+Gsuite+account+for+yourself" target="blank">
                here's how to request it
              </a>.
            </i></p>
          </div>
        </div>

        <div class="field">
          <label class="label">Link to preliminary budget <span class="has-text-danger">*</span> <URLTooltip /></label>
          <div class="control">
            <input class="input" type="url" v-model="event.budget" required />
          </div>
          <p class="help is-danger" v-if="errors.is_budget_set">{{ errors.is_budget_set.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Link to preliminary programme <span class="has-text-danger">*</span> <URLTooltip /></label>
          <div class="control">
            <input class="input" type="url" v-model="event.programme_suct" required />
          </div>
          <p class="help is-danger" v-if="errors.is_programme_set">{{ errors.is_programme_set.join(', ') }}</p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { MglMap, MglMarker, MglNavigationControl } from 'vue-mapbox'
import constants from '../../constants'
import credentials from '../../credentials'
import URLTooltip from '../../components/tooltips/URLTooltip'

export default {
  components: {
    MglMap,
    MglMarker,
    MglNavigationControl,
    URLTooltip
  },
  name: 'EditEvent',
  data () {
    return {
      event: {
        id: null,
        name: null,
        url: null,
        image: null,
        photos: [],
        video: null,
        description: '', // so it won't be null and marked() would not error
        email: null,
        website: null,
        social_media: [],
        organizing_bodies: [],
        locations: [],
        questions: [],
        organizers: [],
        budget: null,
        programme_suct: null,
        activities_list: null,
        university_support: false,
        course_level: null,
        courses: null,
        trainers: null,
        pax_confirmation: null,
        pax_description: null,
        special_equipment: null,
        agreed_to_su_terms: false
      },
      autoComplete: {
        members: { name: '', values: [], loading: false }
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      eventTypes: constants.SUMMERUNIVERSITY_TYPES_NAMES,
      paxConfirmations: constants.SUMMERUNIVERSITY_PAX_CONFIRMATIONS,
      roles: constants.SUMMERUNIVERSITY_ROLES,
      courseLevels: constants.SUMMERUNIVERSITY_COURSE_LEVELS,
      file: null,
      can: {
        editEventType: false,
        editSeason: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    setFile (event) {
      this.file = event.target.files[0]
    },
    updateImage () {
      if (!this.file) {
        return
      }

      const data = new FormData()
      data.append('head_image', this.file)

      this.axios.post(this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/upload', data).then(() => {
        this.$root.showSuccess('Event image is updated.')
        this.file = null
      }).catch((err) => {
        this.$root.showError('Could not update image', err)
      })
    },
    fetchMembers (query) {
      if (!query) return

      this.autoComplete.members.values = []
      this.autoComplete.members.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      // Fetch all of the members of the selected organizing bodies.
      const endpoints = this.event.organizing_bodies.map(body => this.services['core'] + '/bodies/' + body.body_id + '/members')

      // Ignoring the requests that failed (because of 403 most likely)
      // since the user does not always has the permissions to see
      // the members of the body.
      const fetchEndpoint = (endpoint) => this.axios.get(endpoint, {
        cancelToken: this.token.token,
        params: { query }
      }).then(res => res.data.data).catch(() => [])

      // Merging all of the responses into one array.
      // Then filtering out duplicate users.
      // .map is there because the /bodies/:id/members returns users, not members.
      Promise.all(endpoints.map(fetchEndpoint)).then((responses) => {
        this.autoComplete.members.values = responses
          .reduce((acc, val) => acc.concat(val), [])
          .map(value => (value.user))
          .filter((elt, index, array) => array.findIndex(e => e.id === elt.id) === index)

        this.autoComplete.members.loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete.members.loading = false
        this.$root.showError('Could not fetch members', err)
      })
    },
    addOrganizer (organizer) {
      if (this.event.organizers.some(org => org.user_id === organizer.id)) {
        return this.$root.showWarning('This user is already an organizer.')
      }

      this.event.organizers.push({
        user_id: organizer.id,
        first_name: organizer.first_name,
        last_name: organizer.last_name
      })
    },
    deleteOrganizer (index) {
      this.event.organizers.splice(index, 1)
    },
    addQuestion () {
      this.event.questions.push({
        name: '',
        description: '',
        required: false
      })
    },
    deleteQuestion (index) {
      this.event.questions.splice(index, 1)
    },
    addSocialMedia () {
      this.event.social_media.push({
        name: '',
        description: ''
      })
    },
    deleteSocialMedia (index) {
      this.event.social_media.splice(index, 1)
    },
    addPhotos () {
      this.event.photos.push({
        name: '',
        description: ''
      })
    },
    deletePhotos (index) {
      this.event.photos.splice(index, 1)
    },
    addLocation () {
      this.event.locations.push({
        name: '',
        description: '',
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
    saveEvent () {
      if (this.event.organizers.length === 0) {
        return this.$root.showError('Please add at least one organizer.')
      }

      this.isSaving = true
      this.errors = {}

      // we don't need to pass body objects there
      const eventToSave = JSON.parse(JSON.stringify(this.event))
      eventToSave.organizers = eventToSave.organizers.map(org => ({ user_id: org.user_id, role: org.role }))

      this.axios.put(this.services['summeruniversity'] + '/single/' + this.$route.params.id, eventToSave).then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.summeruniversity.view',
          params: { id: response.data.data.url || response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError(this.errors)
        }

        this.$root.showError('Could not save event', err)
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
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    this.axios.get(this.services['core'] + '/my_permissions/').then((response) => {
      this.can.editEventType = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_type'))
      this.can.editSeason = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_season'))

      return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id).then((eventsResponse) => {
        this.event = eventsResponse.data.data
        this.can = eventsResponse.data.permissions
        this.can.editEventType = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_type'))
        this.can.editSeason = response.data.data.some(permission => permission.combined.endsWith('global:edit:su_season'))

        for (const organizer of this.event.organizers) {
          this.axios.get(this.services['core'] + '/members/' + organizer.user_id).then((organizerResponse) => {
            this.$set(organizer, 'first_name', organizerResponse.data.data.first_name)
            this.$set(organizer, 'last_name', organizerResponse.data.data.last_name)
          })

          if (this.loginUser.id === organizer.user_id) {
            this.$set(organizer, 'disableEdit', true)
          }
        }

        this.isLoading = false
      })
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.summeruniversity.list' })
    })
  }
}
</script>
