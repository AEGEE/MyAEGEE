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
      <div class="notification is-info" v-else>
        You can upload event image after saving it.
      </div>

      <form @submit.prevent="saveEvent()">
        <div class="field">
          <label class="label">Title</label>
          <div class="control">
            <input class="input" type="text" required v-model="event.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
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

        <div class="field">
          <label class="label">Event URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/statutory/</a>
              </div>
              <div class="control">
                <input class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <timezone-notification />

        <div class="field">
          <label class="label">Application period starts</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_period_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_starts">{{ errors.application_period_starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Application period ends</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_period_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_ends">{{ errors.application_period_ends.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Board approve deadline</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.board_approve_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.board_approve_deadline">{{ errors.board_approve_deadline.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Participants list publish deadline</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.participants_list_publish_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.participants_list_publish_deadline">{{ errors.participants_list_publish_deadline.join(', ') }}</p>
        </div>

        <div class="field" v-if="event.type === 'agora'">
          <label class="label">Members list submission deadline</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.memberslist_submission_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.memberslist_submission_deadline">{{ errors.memberslist_submission_deadline.join(', ') }}</p>
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

        <div class="tile is-child">
          <div class="field">
            <label class="label">Organizing body</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
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
                  <a class="button is-danger"
                    @click="body => { $set(event, 'body_id', null); $delete(event, 'body') }"
                    v-if="event.body">{{ event.body.name }} (Click to unset)</a>
                  <a class="button is-static" v-if="!event.body">Not set.</a>
                </p>
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.body">{{ errors.body.join(', ')}}</p>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label">Event type</label>
          <div class="control">
            <div class="select">
              <select v-model="event.type">
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

        <div class="field">
          <label class="label">Fee</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input class="input" type="number" v-model.number="event.fee" required min="0"/>
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.message }}</p>
        </div>

        <hr/>

        <div class="subtitle is-fullwidth has-text-centered">Questions</div>

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
                  <select v-model="event.questions[index].type" @change="if (event.questions[index].type === 'select') { $set(event.questions[index], 'values', []); } else { $delete(event.questions[index], 'values'); }">
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

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>

      <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'


export default {
  name: 'EditStatutory',
  components: {
    TimezoneNotification
  },
  data () {
    return {
      event: {
        name: null,
        description: '', // so it won't be null and marked() would not error
        id: null,
        url: null,
        type: 'agora',
        body_id: null,
        application_period_starts: null,
        application_period_ends: null,
        board_approve_deadline: null,
        participants_list_publish_deadline: null,
        memberslist_submission_deadline: null,
        questions: [],
        fee: null,
        starts: null,
        ends: null
      },
      options: [],
      dates: {
        application_period_starts: null,
        application_period_ends: null,
        board_approve_deadline: null,
        participants_list_publish_deadline: null,
        memberslist_submission_deadline: null,
        starts: null,
        ends: null
      },
      newValue: '',
      autoComplete: {
        bodies: { name: '', values: [], loading: false }
      },
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      can: {
        edit_application_status: false
      },
      file: null,
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
      data.append('image', this.file)

      this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/image', data).then(() => {
        this.$root.showSuccess('Event image is updated.')
        this.file = null
      }).catch((err) => {
        const message = err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : err.message
        this.$root.showDanger('Could not update image: ' + message)
      })
    },
    fetchBodies (query) {
      if (!query) return

      this.autoComplete.bodies.values = []
      this.autoComplete.bodies.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/bodies', {
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
        this.$root.showDanger('Could not fetch bodies: ' + err.message)
      })
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
    saveEvent () {
      if (this.event.questions.length === 0) {
        return this.$root.showDanger('Please set at least 1 application question.')
      }

      if (!this.event.application_period_starts) {
        return this.$root.showDanger('Please set the date when applications period will start.')
      }

      if (!this.event.application_period_ends) {
        return this.$root.showDanger('Please set the date when applications period will end.')
      }

      if (!this.event.board_approve_deadline) {
        return this.$root.showDanger('Please set the board approve deadline.')
      }

      if (!this.event.participants_list_publish_deadline) {
        return this.$root.showDanger('Please set the participants list publish deadline.')
      }

      if (this.event.type === 'agora' && !this.event.memberslist_submission_deadline) {
        return this.$root.showDanger('Please set the members list submission deadline.')
      } else if (this.event.type !== 'agora') {
        this.event.memberslist_submission_deadline = null
      }

      if (!this.event.starts) {
        return this.$root.showDanger('Please set the date when the event will start.')
      }

      if (!this.event.ends) {
        return this.$root.showDanger('Please set the date when the event will end.')
      }

      if (!this.event.body_id) {
        return this.$root.showDanger('Please select a body.')
      }

      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-statutory'] + '/events/' + this.$route.params.id, this.event)
        : this.axios.post(this.services['oms-statutory'], this.event)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.statutory.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          if (!err.response.data.errors) {
            return this.$root.showDanger('Some of the event data is invalid: ' + err.response.data.message)
          }

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
  watch: {
    'event.name' (newName) {
      if (!this.$route.params.id) {
        this.event.url = this.$root.sluggify(newName)
      }
    },
    'dates.application_period_starts' (newDate) {
      this.event.application_period_starts = new Date(newDate)
    },
    'dates.application_period_ends' (newDate) {
      this.event.application_period_ends = new Date(newDate)
    },
    'dates.board_approve_deadline' (newDate) {
      this.event.board_approve_deadline = new Date(newDate)
    },
    'dates.participants_list_publish_deadline' (newDate) {
      this.event.participants_list_publish_deadline = new Date(newDate)
    },
    'dates.memberslist_submission_deadline' (newDate) {
      this.event.memberslist_submission_deadline = new Date(newDate)
    },
    'dates.starts' (newDate) {
      this.event.starts = new Date(newDate)
    },
    'dates.ends' (newDate) {
      this.event.ends = new Date(newDate)
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      this.dates.starts = this.event.starts = new Date(this.event.starts)
      this.dates.ends = this.event.starts = new Date(this.event.ends)
      this.dates.application_period_starts = this.event.application_period_starts = new Date(this.event.application_period_starts)
      this.dates.application_period_ends = this.event.application_period_ends = new Date(this.event.application_period_ends)
      this.dates.board_approve_deadline = this.event.board_approve_deadline = new Date(this.event.board_approve_deadline)
      this.dates.participants_list_publish_deadline = this.event.participants_list_publish_deadline = new Date(this.event.participants_list_publish_deadline)
      this.dates.memberslist_submission_deadline = this.event.memberslist_submission_deadline = new Date(this.event.memberslist_submission_deadline)


      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.event.body_id)
    }).then((response) => {
      this.$set(this.event, 'body', response.data.data)
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
