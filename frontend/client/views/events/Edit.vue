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
        <div class="field">
          <label class="label">Title</label>
          <div class="control">
            <input class="input" type="text" v-model="event.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.message}}</p>
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
          <p class="help is-danger" v-if="errors.description">{{ errors.description.message }}</p>
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
          <p class="help is-danger" v-if="errors.url">{{ errors.url.message }}</p>
        </div>

        <div class="field">
          <label class="label">Start date</label>
          <div class="control">
            <b-datepicker v-model="event.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.message }}</p>
        </div>

        <div class="field">
          <label class="label">End date</label>
          <div class="control">
            <b-datepicker v-model="event.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.message }}</p>
        </div>

        <div class="tile is-child" v-if="!$route.params.id">
          <div class="field">
            <label class="label">Organizing body</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  v-model="autoComplete.bodies.name"
                  :data="loginUser.bodies"
                  open-on-focus="true"
                  @select="body => { event.body_id = body.id; event.body = body }">
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
                  <a class="button is-danger"
                    @click="body => { event.body_id = null; event.body = null }"
                    v-if="event.body">{{ event.body.name }} (Click to unset)</a>
                  <a class="button is-static" v-if="!event.body">Not set.</a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="tile is-child" v-if="!$route.params.id">
          <div class="field">
            <label class="label">Event type</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  v-model="autoComplete.eventTypes.name"
                  :data="eventTypes"
                  open-on-focus="true"
                  @select="type => { event.type = type }">
                  <template slot-scope="props">
                    <div class="media">
                      <div class="media-content">
                        {{ props.option }}
                      </div>
                    </div>
                  </template>
                </b-autocomplete>
                <p class="control">
                  <a class="button is-danger"
                    @click="event.type = null"
                    v-if="event.type">{{ event.type }} (Click to unset)</a>
                  <a class="button is-static" v-if="!event.type">Not set.</a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="tile is-parent" v-if="!$route.params.id">
          <div class="tile is-child">
            <div class="notification is-info">
              Please select the event type wisely, as it will influence the event's workflow. <strong>It can't be changed later.</strong>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label">Fee</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input class="input" type="number" v-model="event.fee" min="0"/>
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.message }}</p>
        </div>

        <div class="field">
          <label class="label">Application status</label>
          <div class="select">
            <select v-model="event.application_status">
              <option>open</option>
              <option>closed</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.application_status">{{ errors.application_status.message }}</p>
        </div>

        <div class="field">
          <label class="label">Application deadline</label>
          <div class="control">
            <b-datepicker v-model="event.application_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.application_deadline">{{ errors.application_deadline.message }}</p>
        </div>

        <div class="field">
          <label class="label">Max. participants</label>
          <div class="control">
            <input class="input" type="number" v-model="event.max_participants" min="0"/>
          </div>
          <p class="help is-danger" v-if="errors.max_participants">{{ errors.max_participants.message }}</p>
        </div>

        <hr/>

        <div class="subtitle is-fullwidth has-text-centered">Application fields</div>

        <div v-for="(field, index) in event.application_fields" v-bind:key="index">
          <div class="field">
            <label class="label">Name</label>
            <div class="control">
              <input class="input" type="text" required v-model="field.name"/>
            </div>
          </div>

          <div class="field">
            <label class="label">Description</label>
            <div class="control">
              <input class="input" type="text" required v-model="field.description"/>
            </div>
          </div>

          <div class="field">
            <div class="control">
              <a class="button is-danger" @click="deleteApplicationField(index)">Delete application field</a>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addApplicationField()">Add new application field</a>
          </div>
        </div>

        <hr/>

        <div class="subtitle is-fullwidth has-text-centered">Locations</div>
        <GmapMap
          :class="is-fullwidth"
          :zoom="7"
          :center="center"
          style="height: 400px" >
            <GmapMarker
              :key="index"
              v-for="(marker, index) in event.locations"
              :position="marker.position"
              :draggable="true"
              @dragend="setMarkerPosition($event.latLng, index)" />
        </GmapMap>

        <table class="table is-narrowed is-stripped is-fullwidth">
          <thead>
            <tr>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(marker, index) in event.locations" v-bind:key="index">
              <td>{{ marker.position.lat }}</td>
              <td>{{ marker.position.lng }}</td>
              <td>
                <input type="text" class="input" required v-model="marker.name" />
              </td>
            </tr>
            <tr colspan="3" v-if="event.locations.length === 0">
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

export default {
  name: 'EditEvent',
  data () {
    return {
      event: {
        name: null,
        description: '', // so it won't be null and marked() would not error
        id: null,
        url: null,
        application_status: 'closed',
        application_deadline: null,
        application_fields: [],
        max_participants: null,
        locations: [],
        fee: null,
        status: null,
        starts: null,
        ends: null,
        body_id: null,
        body: null
      },
      center: {
        lat: 50.8503396,
        lng: 4.3517103
      },
      file: null,
      eventTypes: [],
      autoComplete: {
        bodies: { name: '' },
        eventTypes: { name: '' }
      },
      can: {
        edit_application_status: false
      },
      roles: [],
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
        this.$root.showDanger('Could not update image: ' + err.message)
      })
    },
    addApplicationField () {
      this.event.application_fields.push({
        name: '',
        description: ''
      })
    },
    deleteApplicationField (index) {
      this.event.application_fields.splice(index, 1)
    },
    addLocation () {
      this.event.locations.push({
        name: '',
        position: {
          lat: 50.8503396,
          lng: 4.3517103
        }
      })
    },
    setMarkerPosition (position, index) {
      this.event.locations[index].position.lat = position.lat()
      this.event.locations[index].position.lng = position.lng()
    },
    saveEvent () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-events'] + '/single/' + this.$route.params.id, this.event)
        : this.axios.post(this.services['oms-events'], this.event)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the event data is invalid.')
        }

        this.$root.showDanger('Could not save event: ' + err.message)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    this.axios.get(this.services['oms-events'] + '/eventroles').then((response) => {
      this.roles = response.data.data
    }).catch((err) => {
      this.$root.showDanger('Could not fetch event roles: ' + err.message)
    })

    if (!this.$route.params.id) {
      this.axios.get(this.services['oms-events'] + '/lifecycle/names').then((response) => {
        this.eventTypes = response.data.data
      }).catch((err) => {
        this.$root.showDanger('Could not fetch event types: ' + err.message)
      })

      return
    }

    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions.can

      this.event.starts = new Date(this.event.starts)
      this.event.ends = new Date(this.event.ends)
      if (this.event.application_deadline) this.event.application_deadline = new Date(this.event.application_deadline)

      this.isLoading = false
      this.$forceUpdate()
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
