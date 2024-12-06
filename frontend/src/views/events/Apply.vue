<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title" v-show="isNew">Apply to {{ event.name }}</div>
        <div class="title" v-show="!isNew && this.can.apply">Edit your application on {{ event.name }}</div>
        <div class="title" v-show="!isNew && !this.can.apply">See your application on {{ event.name }}</div>

        <div class="subtitle" v-show="isNew && !this.can.apply">You cannot apply: the applications are closed or the event is not published yet.</div>

        <form @submit.prevent="saveApplication()">
          <div class="tile is-parent" v-show="this.can.apply">
            <div class="tile is-child">
              <div class="field">
                <label class="label">Body <span class="has-text-danger">*</span></label>
                <div class="select" v-show="bodies.length > 0">
                  <select v-model="application.body_id">
                    <option v-for="body in bodies" v-bind:key="body.id" :value="body.id">{{ body.name }}</option>
                  </select>
                </div>
              </div>

              <event-no-body-notification v-show="bodies.length == 0" />

              <div class="notification is-danger" v-if="errors.answers || errors.body_id || errors.gender || errors.date_of_birth">
                <div class="content">
                  Could not apply because of these reasons:
                  <ul>
                    <li v-for="(error, index) in errors.answers" v-bind:key="index">{{ error }}</li>
                  </ul>
                  <ul>
                    <li v-for="(error, index) in errors.body_id" v-bind:key="index">{{ error }}</li>
                  </ul>
                  <ul v-if="errors.gender">
                    <li>Please set the gender in <router-link :to="{ name: 'oms.members.view', params: { id: 'me' } }" target='_blank' rel='noopener noreferrer'>your profile.</router-link></li>
                  </ul>
                  <ul v-if="errors.date_of_birth">
                    <li>Please set the date of birth in <router-link :to="{ name: 'oms.members.view', params: { id: 'me' } }" target='_blank' rel='noopener noreferrer'>your profile.</router-link></li>
                  </ul>
                </div>
              </div>

              <div class="field is-fullwidth" v-for="(question, index) in event.questions" v-bind:key="index">
                <div class="control">
                  <label class="has-text-weight-bold">
                    {{ question.description }} <span class="has-text-danger" v-if="question.required">*</span>
                  </label>
                </div>
                <div class="control" v-if="question.type === 'text'">
                  <textarea
                    class="textarea"
                    :required="question.required"
                    v-model="application.answers[index]" />
                </div>
                <div class="control" v-if="question.type === 'string'">
                  <input
                    class="input"
                    type="text"
                    :required="question.required"
                    v-model="application.answers[index]" />
                </div>
                <div class="control" v-if="question.type === 'number'">
                  <input
                    class="input"
                    type="number"
                    v-model.number="application.answers[index]" />
                </div>
                <div class="control" v-if="question.type === 'checkbox'">
                  <input
                    class="checkbox"
                    type="checkbox"
                    :required="question.required"
                    v-model="application.answers[index]" />
                </div>
                <div class="control" v-if="question.type === 'select'">
                  <div class="select">
                    <select v-model="application.answers[index]" required>
                      <option v-for="(value, index) in question.values" v-bind:key="index">{{ value }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="field">
                <label class="checkbox">
                  I agree with my personal data to be processed
                  by AEGEE-Europe for the purposes of the participant selection
                  and event organisation. AEGEE-Europe will disclose this data
                  to organising local for the time period of the event organisation.
                  <input type="checkbox" required v-model="application.agreed_to_privacy_policy" />
                </label>
                <p class="help is-danger" v-if="errors.agreed_to_privacy_policy">{{ errors.agreed_to_privacy_policy.join(', ') }}</p>
              </div>

              <div class="field">
                <button type="submit" class="button is-primary">
                  Save application!
                </button>
              </div>
            </div>
          </div>

          <div v-show="!isNew && !this.can.apply" class="tile is-parent">
            <div class="tile is-child">
              <p>
                <b>You applied from this body:</b>
                <router-link target="_blank" rel="noopener noreferrer" :to="{ name: 'oms.bodies.view', params: { id: application.body_id } }">
                  {{ application.body ? application.body.name : 'Loading...' }}
                </router-link>
              </p>
              <table class="table is-narrow is-fullwidth">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Your answer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(field, index) in event.questions" v-bind:key="index">
                    <td><b>{{ field.description }}</b><span class="is-danger" ng-show="field.required">*</span></td>
                    <td>{{ application.answers[index] | beautify }}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>
                        I agree with my personal data to be processed
                        by AEGEE-Europe for the purposes of the participant selection
                        and event organisation. AEGEE-Europe will disclose this data
                        to organising local for the time period of the event organisation.
                      </b>
                    </td>
                    <td>{{ application.agreed_to_privacy_policy | beautify }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="field" v-show="event.questions.length === 0">
                <div class="notification is-info">
                  You didn't need to fill in the application fields.
                </div>
              </div>
            </div>
          </div>

          <div class="tile is-parent" v-show="!isNew && !this.can.apply">
            <div class="tile is-child">
              <div class="notification is-warning" v-if="application.status === 'pending'">
                Your application is being processed, please wait for the organizers to evaluate your application. Unfortunately you can not edit it anymore.
              </div>
              <div class="notification is-success" v-else-if="application.status === 'accepted'">
                Congratulations, you have been accepted to the event!
              </div>
              <div class="notification is-success" v-else-if="application.status === 'rejected'">
                Sorry, but you were not accepted to the event.
              </div>
            </div>
          </div>

          <b-loading is-full-page="false" :active.sync="isLoading" />
        </form>
      </div>
    </div>
  </div>

</template>

<script>
import { mapGetters } from 'vuex'
import EventNoBodyNotification from '../../components/notifications/EventNoBodyNotification'

export default {
  name: 'ApplyToEvent',
  components: {
    EventNoBodyNotification
  },
  data () {
    return {
      event: {
        name: null,
        questions: []
      },
      bodies: [],
      application: {
        body: null,
        body_id: null,
        user: null,
        user_id: null,
        id: null,
        answers: [],
        agreed_to_privacy_policy: false
      },
      can: {
        apply: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveApplication () {
      if (!this.application.body_id) {
        return this.$root.showError('Please select a body.')
      }

      // Copy data from the form into an object to submit it in the format the backend needs it
      this.isSaving = true

      const toServer = {
        body_id: this.application.body_id,
        answers: this.application.answers,
        agreed_to_privacy_policy: this.application.agreed_to_privacy_policy
      }

      const request = this.isNew
        ? this.axios.post(this.services['events'] + '/single/' + this.$route.params.id + '/applications', toServer)
        : this.axios.put(this.services['events'] + '/single/' + this.$route.params.id + '/applications/' + this.$route.params.application_id, toServer)

      request.then(() => {
        this.$root.showSuccess('Your application was saved, you can still edit it until the application period ends')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the application data is invalid.')
        }

        this.$root.showError('Could not save application', err)
      })
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    isNew () {
      return !this.application.id
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      this.can.apply = this.event.application_status === 'open' && this.event.status === 'published'

      // Prefilling default values for application answers
      this.application.answers = Array.from({ length: this.event.questions.length }, (value, index) => {
        switch (this.event.questions[index].type) {
        case 'number':
          return 0
        case 'checkbox':
          return false
        case 'select':
          return this.event.questions[index].values[0]
        default:
          return ''
        }
      })

      this.bodies = this.loginUser.bodies

      // Setting 1st body as an application body if possible
      if (this.bodies.length > 0) {
        this.application.body_id = this.bodies[0].id
      }

      return this.axios.get(this.services['events'] + '/single/' + this.$route.params.id + '/applications/' + this.$route.params.application_id).then((application) => {
        this.application = application.data.data
        this.application.body = this.bodies.find(body => body.id === this.application.body_id)

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        // if there's no application, just ignore, otherwise re-throw the error
        if (err.response.status !== 404) {
          throw err
        }
      })
    }).catch((err) => {
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
