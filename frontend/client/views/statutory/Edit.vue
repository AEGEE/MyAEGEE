<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <!--<div v-if="$route.params.id">
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
      </div>-->

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
                <a class="button is-static">/statutory/</a>
              </div>
              <div class="control">
                <input class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.message }}</p>
        </div>

        <div class="field">
          <label class="label">Application period starts</label>
          <div class="control">
            <b-datepicker :min-date="new Date()" v-model="event.application_period_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_starts">{{ errors.application_period_starts.message }}</p>
        </div>

        <div class="field">
          <label class="label">Application period ends</label>
          <div class="control">
            <b-datepicker :min-date="new Date()" v-model="event.application_period_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_ends">{{ errors.application_period_ends.message }}</p>
        </div>

        <div class="field">
          <label class="label">Start date</label>
          <div class="control">
            <b-datepicker :min-date="new Date()" v-model="event.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.message }}</p>
        </div>

        <div class="field">
          <label class="label">End date</label>
          <div class="control">
            <b-datepicker :min-date="new Date()" v-model="event.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.message }}</p>
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
                @select="body => { event.body_id = body.id; event.body = body; }">
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
          <p class="help is-danger" v-if="errors.body">{{ errors.body.join(', ')}}</p>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label">Event type</label>
          <div class="control">
            <div class="select">
              <select v-model="event.type">
                <option value="agora">Agora</option>
                <option value="epm">EPM</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ')}}</p>
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

        <hr/>

        <div class="subtitle is-fullwidth has-text-centered">Questions</div>

        <table class="table is-fullwidth is-narrowed">
          <thead>
            <tr>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, index) in event.questions" v-bind:key="index">
              <td>
                <input class="input" type="text" required v-model="event.questions[index]"/>
              </td>
              <td>
                <a class="button is-danger" @click="deleteQuestion(index)">Delete question</a>
              </td>
            </tr>
            <tr colspan="2" v-if="event.questions.length === 0">
              <td>No questions are set.</td>
            </tr>
          </tbody>
        </table>

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

export default {
  name: 'EditStatutory',
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
        application_period_endss: null,
        questions: [],
        fee: null,
        starts: null,
        ends: null
      },
      autoComplete: {
        bodies: { name: '', values: [], loading: false }
      },
      can: {
        edit_application_status: false
      },
      errors: {},
      isLoading: false,
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
      this.event.questions.push('')
    },
    deleteQuestion (index) {
      this.event.questions.splice(index, 1)
    },
    saveEvent () {
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
        this.event.url = newName.toLowerCase().replace(/ /g, '-')
      }
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      this.event.starts = new Date(this.event.starts)
      this.event.ends = new Date(this.event.ends)
      this.event.application_period_starts = new Date(this.event.application_period_starts)
      this.event.application_period_ends = new Date(this.event.application_period_ends)

      this.isLoading = false
      this.$forceUpdate()
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
