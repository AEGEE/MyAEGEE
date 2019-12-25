<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div v-if="$route.params.id">
        <div class="subtitle">Update event image</div>

        <div class="field is-grouped">
          <div class="control">
            <div class="file has-name">
              <label class="file-label">
                <input class="file-input" type="file" name="resume" @change="setFile($event)">
                <span class="file-cta">
                  <span class="file-icon">
                    <i class="fa fa-upload"></i>
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
      </div>

      <form @submit.prevent="saveEvent()">
        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>If you want to upload the image, please add it after creating the event by going to "Edit event" and uploading it there.</p>
            <p><strong>If the event is not published, people won't be able to see the event in the listing or apply to it.</strong></p>
            <p>Also, <strong>once the event is published you won't be able to edit it.</strong> So please check everything twice.</p>
            <p>If you will need the event info to be changed after publishing, please contact CD or EQAC.</p>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Event details</div>
        <hr />

        <div class="field">
          <label class="label">Title</label>
          <div class="control">
            <input class="input" type="text" v-model="event.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="event.description"></textarea>
          </div>
          <label class="label">Description preview</label>
          <div class="content">
            <span v-html="$options.filters.markdown(event.description)">
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>
              Event URL is the "short name of the event" and is the part of the address this event would be accessible at.
              That can be handy for the generation of nice events URLs.
            </p>
            <p>For example, when set as <i>my-awesome-event</i>, the event would be accessible at <i>https://my.aegee.eu/events/my-awesome-event</i>.</p>
            <p>It can contain only English letters, numbers and cannot have numbers only.</p>
            <p><strong>Please don't put Facebook event link here, this is meant for another purpose described above</strong>.</p>
          </div>
        </div>

        <div class="field">
          <label class="label">Event URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/events/</a>
              </div>
              <div class="control">
                <input class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          Please select the event type wisely. <strong>It can't be changed later.</strong>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label">Event type</label>
          <div class="select">
            <select v-model="event.type">
              <option v-for="(name, type) in eventTypes" v-bind:key="type" v-bind:value="type">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Fee</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input class="input" type="number" v-model="event.fee" min="0" required />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.join(', ') }}</p>
        </div>
        <div class="field">
          <label class="label">Max. participants</label>
          <div class="control">
            <input class="input" type="number" v-model="event.max_participants" min="0" @input="if (event.max_participants === '') event.max_participants = null"/>
          </div>
          <p class="help is-danger" v-if="errors.max_participants">{{ errors.max_participants.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Event dates</div>
        <hr />

        <timezone-notification />

        <div class="field">
          <label class="label">Application period starts</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_starts">{{ errors.application_starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Application period ends</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_ends">{{ errors.application_ends.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Event start date</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Event end date</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              :config="dateConfig"
              v-model="dates.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Organizing bodies</div>
        <hr />

        <div class="tags">
          <a class="tag is-primary is-medium"
            v-for="(body, index) in event.organizing_bodies"
            v-bind:key="body.body_id">
            {{ body ? body.body.name : 'Loading...' }}
            <button class="delete is-small" @click.prevent="body => event.organizing_bodies.splice(index, 1)" />
          </a>
          <a class="tag is-danger is-medium" v-if="event.organizing_bodies.length === 0">No organizing bodies.</a>
        </div>

        <div class="field">
          <label class="label">Add organizing body</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <div class="select">
                  <select v-model="selectedBody">
                    <option :value="null">--</option>
                    <option v-for="body in bodies" v-bind:key="body.id" v-bind:value="body">{{ body.name }}</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <a class="button is-primary" @click="addOrganizingBody()">Add</a>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Organizers</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>The user creating the event automatically becomes the organizer.</p>
            <p>People who are not listed as organizers won't be able to see and manage event manage applications, even if they are the board members.</p>
            <p v-if="!can.viewAllMembers">
              <strong>You can only add people from your bodies.</strong>
              If a person from another body needs to be added as an organizer, you can temporarily join this body to get the permissions
              to see members of this body, add required people, then leave it.
            </p>
            <p>Organizers list cannot be edited once the event is published, if you need to update it, please contact EQAC or CD.</p>
          </div>
        </div>

        <div>
          <b-table
            :data="event.organizers"
            :loading="isLoading">
            <template slot-scope="props">
               <b-table-column field="first_name" label="First and last name" sortable>
                <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                  {{ props.row.first_name }} {{ props.row.last_name }}
                </router-link>
              </b-table-column>

              <b-table-column field="comment" label="Comment">
                <div class="control">
                  <input class="input" type="text" v-model="props.row.comment"/>
                </div>
              </b-table-column>

              <b-table-column label="Delete">
                <button class="button is-small is-danger" v-if="!props.row.disableEdit" k="askDeleteOrganizer(props.index)">
                  Delete
                </button>
              </b-table-column>
            </template>

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

        <div class="subtitle is-fullwidth has-text-centered">Questions</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>
              Keep in mind that the only questions gathered from users by default are body name and application consent.
              So, if you need some other fields in the application form (like motivation, visa fields etc.), you have to add them manually.
            </p>
            <p>Some fields (specifically, the email) are copied from the profile when applying, so you don't need to ask for it.</p>
            <p>Here are the question types that can be used:</p>
            <ul>
              <li><b>string</b> - short string value (like "Meals type")</li>
              <li><b>text</b> - long string value (like "Why I'm a good participant")</li>
              <li><b>number</b> - a number (like "How much events in AEGEE I've visited")</li>
              <li><b>select</b> - predefined set of values (like "Vegan", "Vegetarian" and "Meat-eater" for meals type)</li>
              <li><b>checkbox</b> - a yes/no question (like "Do I need a visa?").
                Combine it with "requred" field to only allow this to be checked in order to to apply (like "I give my consent to share my data with third parties")
              </li>
            </ul>
          </div>
        </div>

        <table class="table is-fullwidth is-narrowed">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th>Required (works for text and string)?</th>
              <th>Values (for select)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, index) in event.questions" v-bind:key="index">
              <td>
                <input class="input" type="text" required v-model="event.questions[index].description"/>
              </td>
              <td>
                <div class="select">
                  <select v-model="event.questions[index].type" @change="if (event.questions[index].type === 'select') { $set(event.questions[index], 'values', []) } else { $delete(event.questions[index], 'values'); }">
                    <option value="string">String</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="select">Select</option>
                  </select>
                </div>
              </td>
              <td>
                <input type="checkbox" v-model="event.questions[index].required" />
              </td>
              <td>
                <input-tag
                  v-if="event.questions[index].type === 'select'"
                  v-model="event.questions[index].values"
                  :before-adding="value => value.trim()"></input-tag>
              </td>
              <td>
                <a class="button is-danger" @click="deleteQuestion(index)">Delete question</a>
              </td>
            </tr>
            <tr colspan="5" v-if="event.questions.length === 0">
              <td>No questions are set.</td>
            </tr>
          </tbody>
        </table>

        <div class="notification is-danger" v-if="errors.questions">
          <div class="content">
          Could not create/edit event because of these reasons:
            <ul v-if="errors.questions">
              <li v-for="(error, index) in errors.questions" v-bind:key="index">{{ error }}</li>
            </ul>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addQuestion()">Add new question</a>
          </div>
        </div>

        <p class="help is-danger" v-if="errors.fee">{{ errors.questions.message }}</p>

        <div class="subtitle is-fullwidth has-text-centered">Locations</div>
        <hr/>

        <div class="tile" style="position: relative; height: 400px">
          <MglMap
            :accessToken="accessToken"
            :mapStyle="map.style"
            :zoom="map.zoom"
            :scrollZoom="false"
            @load="onMapLoaded"
            :center="map.center" >
            <MglNavigationControl position="top-right" />
            <MglMarker
              v-for="(location, index) in event.locations"
              v-bind:key="index"
              :coordinates="location.position"
              color="red"
              :draggable="true"
              @dragend="setMarkerPosition($event, index)"/>
          </MglMap>
        </div>

        <table class="table is-narrowed is-stripped is-fullwidth">
          <thead>
            <tr>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Name</th>
              <th>
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
                <button class="button is-danger" @click="deleteLocation(index)">Delete location</button>
              </td>
            </tr>
            <tr colspan="4" v-if="event.locations.length === 0">
              <td>No locations added.</td>
            </tr>
          </tbody>
        </table>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addLocation()">Add new location</a>
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import Mapbox from 'mapbox-gl'
import { MglMap, MglMarker, MglNavigationControl } from 'vue-mapbox'
import constants from  '../../constants'
import credentials from  '../../credentials'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'

export default {
  components: {
    MglMap,
    MglMarker,
    MglNavigationControl,
    TimezoneNotification
  },
  name: 'EditEvent',
  data () {
    return {
      event: {
        name: null,
        description: '', // so it won't be null and marked() would not error
        id: null,
        url: null,
        questions: [],
        organizing_bodies: [],
        organizers: [],
        max_participants: null,
        locations: [],
        fee: null,
        application_starts: null,
        application_ends: null,
        starts: null,
        ends: null,
        body_id: null,
        body: null
      },
      autoComplete: {
        members: { name: '', values: [], loading: false }
      },
      dates: {
        application_starts: null,
        application_ends: null,
        starts: null,
        ends: null
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 8
      },
      eventTypes: constants.EVENT_TYPES_NAMES,
      file: null,
      bodies: [],
      selectedBody: null,
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      can: {
        edit_application_status: false,
        viewAllMembers: false
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

      this.axios.post(this.services['oms-events'] + '/single/' + this.$route.params.id + '/upload', data).then(() => {
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

      // If user has global permission, fetching global members list.
      // Otherwise, fetch all of the members of the bodies this user is a member of.
      const endpoints = this.can.viewAllMembers
        ? [this.services['oms-core-elixir'] + '/members']
        : this.loginUser.bodies.map(body => this.services['oms-core-elixir'] + '/bodies/' + body.id +  '/members')

      Promise.all(endpoints.map(endpoint => {
        // Ignoring the requests that failed (because of 403 most likely)
        // since the user does not always has the permissions to see
        // the members of the body.
        return this.axios.get(endpoint, {
          cancelToken: this.token.token,
          params: { query }
        }).then(res => res.data.data).catch(() => [])
      })).then((responses) => {
        // Merging all of the responses into one array.
        // Then filtering out duplicate users.
        // .map is there because the /bodies/:id/members returns users, not members.
        this.autoComplete.members.values = responses
          .reduce((acc, val) => acc.concat(val), [])
          .map(value => this.can.viewAllMembers ? value : value.member)
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
        user: organizer,
        first_name: organizer.first_name,
        last_name: organizer.last_name
      })
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
    addLocation () {
      this.event.locations.push({
        name: '',
        position: {
          lat: this.map.center.lat,
          lng: this.map.center.lng
        }
      })
    },
    deleteLocation(index) {
      this.event.locations.splice(index, 1)
    },
    setMarkerPosition (event, index) {
      const newCoords = event.marker.getLngLat()

      this.event.locations[index].position.lat = newCoords.lat
      this.event.locations[index].position.lng = newCoords.lng
    },
    addOrganizingBody() {
      if (!this.selectedBody) {
        this.$root.showWarning('Please select a body.')
        return
      }

      if (this.event.organizing_bodies.some(body => body.body_id === this.selectedBody.id)) {
        this.$root.showWarning('This body is already presented in the organizing bodies list.')
        return
      }

      this.event.organizing_bodies.push({
        body: this.selectedBody,
        body_id: this.selectedBody.id
      })
      this.selectedBody = null
    },
    saveEvent () {
      if (!this.event.application_starts) {
        return this.$root.showError('Please set the date when applications period will start.')
      }

      if (!this.event.application_ends) {
        return this.$root.showError('Please set the date when applications period will end.')
      }

      if (!this.event.starts) {
        return this.$root.showError('Please set the date when the event will start.')
      }

      if (!this.event.ends) {
        return this.$root.showError('Please set the date when the event will end.')
      }

      if (this.event.organizing_bodies.length === 0) {
        return this.$root.showError('Please select at least one organizing body.')
      }

      if (this.event.organizers.length === 0) {
        return this.$root.showError('Please add at least one organizer.')
      }

      this.isSaving = true
      this.errors = {}

      // we don't need to pass body objects there
      const eventToSave = JSON.parse(JSON.stringify(this.event))
      eventToSave.organizing_bodies = eventToSave.organizing_bodies.map(body => ({ body_id: body.body_id }))
      eventToSave.organizers = eventToSave.organizers.map(org => ({ user_id: org.user_id }))

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-events'] + '/single/' + this.$route.params.id, eventToSave)
        : this.axios.post(this.services['oms-events'], eventToSave)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: response.data.data.url || response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the event data is invalid.')
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
        this.map.actions.flyTo({ center: this.event.locations[0].position })
        return
      }

      this.map.actions.fitBounds(this.event.locations.map(location => location.position), { padding: 50 })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    'event.name' (newName) {
      if (!this.$route.params.id) {
        this.event.url = this.$root.sluggify(newName)
      }
    },
    'dates.application_starts' (newDate) {
      this.event.application_starts = new Date(newDate)
    },
    'dates.application_ends' (newDate) {
      this.event.application_ends = new Date(newDate)
    },
    'dates.starts' (newDate) {
      this.event.starts = new Date(newDate)
    },
    'dates.ends' (newDate) {
      this.event.ends = new Date(newDate)
    }
  },
  mounted () {
    this.axios.get(this.services['oms-core-elixir'] + '/bodies/').then((response) => {
      this.bodies = response.data.data

      return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions/')
    }).then((response) => {
      this.can.viewAllMembers = response.data.data.some(permission => permission.combined.endsWith('global:view:member'))

      if (!this.$route.params.id) {
        this.isLoading = false
        this.event.organizers.push({
          user_id: this.loginUser.id,
          first_name: this.loginUser.first_name,
          last_name: this.loginUser.last_name,
          comment: 'Event creator.',
          disableEdit: true
        })
        return
      }

      return this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((eventsResponse) => {
        this.event = eventsResponse.data.data
        this.can = eventsResponse.data.permissions
        this.can.viewAllMembers = response.data.data.some(permission => permission.combined.endsWith('global:view:member')) // override it

        this.dates.starts = this.event.starts = new Date(this.event.starts)
        this.dates.ends = this.event.starts = new Date(this.event.ends)
        this.dates.application_starts = this.event.application_starts = new Date(this.event.application_starts)
        this.dates.application_ends = this.event.application_ends = new Date(this.event.application_ends)

        for (const body of this.event.organizing_bodies) {
          const foundBody = this.bodies.find(b => b.id === body.body_id)
          this.$set(body, 'body', foundBody)
        }

        for (const organizer of this.event.organizers) {
          if (this.loginUser.id === organizer.user_id) {
            this.$set(organizer, 'disableEdit', true)
            break
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

      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
