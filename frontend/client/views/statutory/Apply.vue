<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title" v-show="isNew">Apply to {{ event.name }}</div>
        <div class="title" v-show="!isNew && can.apply">Edit your application on {{ event.name }}</div>
        <div class="title" v-show="!isNew && !can.apply">See your application on {{ event.name }}</div>

        <form @submit.prevent="saveApplication()">
          <div class="tile is-parent" v-show="isNew || can.apply">
            <div class="tile is-child">
              <div class="field">
                <label class="label">Select body to apply from</label>
                <div class="control">
                  <div class="field has-addons">
                    <b-autocomplete
                      v-model="autoComplete.bodies.name"
                      :data="loginUser.bodies"
                      open-on-focus="true"
                      @select="body => { application.body_id = body.id; application.body = body; saved = false }">
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
                        @click="body => { application.body_id = null; application.body = null; saved = false }"
                        v-if="application.body">{{ application.body.name }} (Click to unset)</a>
                      <a class="button is-static" v-if="!application.body">Not set.</a>
                    </p>
                  </div>
                </div>
              </div>

              <div class="field is-fullwidth" v-for="(question, index) in event.questions" v-bind:key="index">
                <div class="control">
                  <label class="has-text-weight-bold">{{ question }}</label>
                </div>
                <div class="control">
                  <textarea
                    class="textarea"
                    required
                    v-model="application.answers[index]"
                    @input="saved=false"
                    />
                </div>
              </div>

              <div class="field">
                <button type="submit" class="button is-info" v-show="!saved">
                  Save application!
                </button>
                <button type="submit" class="button is-primary" disabled="disabled" v-show="saved">
                  Application saved!
                </button>
              </div>
            </div>
          </div>

          <div v-show="!isNew && !can.apply" class="tile is-parent">
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
                    <th>Question</th>
                    <th>Your answer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(question, index) in event.questions" v-bind:key="index">
                    <th>{{ question }}</th>
                    <td>{{ application.answers[index] }}</td>
                  </tr>
                </tbody>
              </table>

              <table class="table is-narrow is-fullwidth">
                <tbody>
                  <tr>
                    <th>Participant type</th>
                    <td v-if="application.participant_type">{{ application.participant_type }}</td>
                    <td v-if="!application.participant_type"><i>Not set yet.</i></td>
                  </tr>
                  <tr>
                    <th>Board comment</th>
                    <td v-if="application.board_comment">{{ application.board_comment }}</td>
                    <td v-if="!application.board_comment"><i>Not set yet.</i></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="tile is-parent" v-show="!isNew">
            <div class="tile is-child">
              <div class="notification is-warning" v-if="application.status === 'pending'">
                Your application is being processed, please wait for the organizers to evaluate your application.
                <span v-if="!can.apply">Unfortunately you can not edit it any more.</span>
              </div>
              <div class="notification is-success" v-if="application.status === 'accepted'">
                Congratulations, you have been accepted to the event!
              </div>
              <div class="notification is-success" v-if="application.status === 'rejected'">
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
  name: 'ApplyToStatutoryEvent',
  data () {
    return {
      event: {
        name: null,
        questions: []
      },
      autoComplete: { bodies: { name: '' } },
      application: {
        body: null,
        body_id: null,
        id: null,
        answers: []
      },
      can: {
        apply: false
      },
      saved: true,
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveApplication () {
      // Copy data from the form into an object to submit it in the format the backend needs it
      this.isSaving = true

      const toServer = {
        body_id: this.application.body.id,
        answers: this.application.answers
      }

      const promise = this.isNew
        ? this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications', toServer)
        : this.axios.put(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/me', toServer)

      promise.then(() => {
        this.$root.showSuccess('Your application was saved, you can still edit it until the application period ends')

        return this.$router.push({
          name: 'oms.statutory.view',
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
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions
      this.application.answers = Array.from({ length: this.event.questions }, () => '')

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/me').then((application) => {
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
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
