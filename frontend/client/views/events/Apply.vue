<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title" v-show="isNew">Apply to {{ event.name }}</div>
        <div class="title" v-show="!isNew && event.application_status === 'open'">Edit your application on {{ event.name }}</div>
        <div class="title" v-show="!isNew && event.application_status === 'closed'">See your application on {{ event.name }}</div>

        <form @submit.prevent="saveApplication()">
          <div class="tile is-parent" v-show="isNew || (event.application_status === 'open')">
            <div class="tile is-child">
              <div class="field" v-show="autoComplete.bodies.values.length > 0">
                <label class="label">Select body to apply from</label>
                <div class="control">
                  <div class="field has-addons">
                    <b-autocomplete
                      v-model="autoComplete.bodies.name"
                      :data="loginUser.bodies"
                      open-on-focus="true"
                      @select="body => { application.body_id = body.id; application.body = body }">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.name }}
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                    <p class="control">
                      <a class="button is-danger"
                        @click="body => { application.body_id = null; application.body = null }"
                        v-if="application.body">{{ application.body.name }} (Click to unset)</a>
                      <a class="button is-static" v-if="!application.body">Not set.</a>
                    </p>
                  </div>
                </div>
              </div>

              <div class="notification is-danger" v-show="autoComplete.bodies.values.length == 0">
                <div class="content">
                  <p>You are not a member of any body, therefore you cannot apply.</p>
                  <p>To apply to a statutory event, you need to be a member of at least one body.</p>
                  <p>For that, go to Bodies, send a join request to the body you are in and wait for the board to approve it</p>
                </div>
              </div>

              <div class="notification is-danger" v-if="errors.answers || errors.body_id || errors.gender|| errors.date_of_birth">
                <div class="content">
                Could not apply because of these reasons:
                  <ul>
                    <li v-for="(error, index) in errors.answers" v-bind:key="index">{{ error }}</li>
                  </ul>
                  <ul>
                    <li v-for="(error, index) in errors.body_id" v-bind:key="index">{{ error }}</li>
                  </ul>
                  <ul v-if="errors.gender">
                    <li>Please set the gender in <router-link :to="{ name: 'oms.members.view', params: { id: 'me' } }" target='_blank'>your profile.</router-link></li>
                  </ul>
                  <ul v-if="errors.date_of_birth">
                    <li>Please set the date of birth in <router-link :to="{ name: 'oms.members.view', params: { id: 'me' } }" target='_blank'>your profile.</router-link></li>
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

              <div class="field" v-show="event.questions.length == 0">
                <p class="notification is-info">
                  You do not need to fill in any application fields to apply for this event! Just press the button.
                </p>
              </div>

              <div class="field">
                <button type="submit" class="button is-primary">
                  Save application!
                </button>
              </div>
            </div>
          </div>

          <div v-show="!isNew && event.application_status === 'closed'" class="tile is-parent">
            <div class="tile is-child">
              <p>
                <b>You applied from this body:</b>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: application.body_id } }">
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
                    <td>{{ field.answer | beautify }}</td>
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

          <div class="tile is-parent" v-show="!isNew && event.application_status === 'closed'">
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

          <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
        </form>
      </div>
    </div>
  </div>

</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ApplyToEvent',
  data () {
    return {
      event: {
        name: null,
        questions: []
      },
      autoComplete: { bodies: { name: '', values: [] } },
      application: {
        body: null,
        body_id: null,
        user: null,
        user_id: null,
        id: null,
        answers: []
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveApplication () {
      if (!this.application.body_id) {
        return this.$root.showDanger('Please select a body.')
      }

      // Copy data from the form into an object to submit it in the format the backend needs it
      this.isSaving = true

      const toServer = {
        body_id: this.application.body.id,
        answers: this.application.answers
      }

      this.axios.put(this.services['oms-events'] + '/single/' + this.$route.params.id + '/applications/mine', toServer).then(() => {
        this.$root.showSuccess('Your application was saved, you can still edit it until the application period ends')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the application data is invalid.')
        }

        this.$root.showDanger('Could not save application: ' + err.message)
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
    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

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

      return this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id + '/applications/mine').then((application) => {
        this.application = application.data.data
        this.application.body = this.loginUser.bodies.find(body => body.id === this.application.body_id)

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        // if there's no application, just ignore, otherwise re-throw the error
        if (err.response.status !== 404) {
          throw err
        }
      })
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
