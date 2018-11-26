<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">See application on {{ event.name }}</div>

        <div class="tile is-parent" v-show="!this.application">
          <div class="tile is-child">
            <div class="subtitle">You haven't applied to this event yet.</div>
          </div>
        </div>

        <div class="tile is-parent" v-if="this.application">
          <div class="tile is-child">
            <p>
              <b v-show="this.application.user_id === this.loginUser.id">You applied from this body:</b>
              <b v-show="this.application.user_id !== this.loginUser.id">Application from the body:</b>
              <router-link :to="{ name: 'oms.bodies.view', params: { id: application.body_id } }">
                {{ application.body ? application.body.name : 'Loading...' }}
              </router-link>
            </p>
            <p v-show="this.application.user_id !== this.loginUser.id">
              <b>Member name:</b>
              <router-link :to="{ name: 'oms.members.view', params: { id: application.user_id } }">
                {{ application.user ? application.user.first_name + ' ' + application.user.last_name : 'Loading...' }}
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
                  <th>{{ question.description }}</th>
                  <td>{{ application.answers[index] | beautify }}</td>
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
                  <th>Participant order</th>
                  <td v-if="application.participant_order">{{ application.participant_order }}</td>
                  <td v-if="!application.participant_order"><i>Not set yet.</i></td>
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

        <div class="tile is-parent" v-if="application && !application.cancelled">
          <div class="tile is-child">
            <div class="notification is-warning" v-show="application.status === 'pending'">
              Your application is recorded, please wait for the organizers to evaluate your application.
              <span v-show="can.edit_application">You can still edit it till the application period ends.</span>
            </div>
            <div class="notification is-success" v-show="application.status === 'accepted'">
              Congratulations, you have been accepted to the event!
            </div>
            <div class="notification is-danger" v-show="application.status === 'rejected'">
              Sorry, but you were not accepted to the event.
            </div>
          </div>
        </div>

        <div class="tile is-parent" v-if="application && application.cancelled">
          <div class="tile is-child">
            <div class="notification is-danger">
              Your application is cancelled.
              <span v-if="can.set_application_cancelled">You can uncancel it till the application period ends.</span>
            </div>
          </div>
        </div>

        <div class="notification is-danger" v-show="!application && !can.apply && new Date() < event.application_period_starts">
          You cannot apply to this event: application period hasn't started yet.
        </div>

        <div class="notification is-danger" v-show="!application && !can.apply && new Date() < event.application_period_starts">
          You cannot apply to this event: application period is over.
        </div>

        <div class="notification is-danger" v-show="application && !can.edit_application && new Date() < event.application_period_starts">
          You cannot edit your application anymore: application period is over.
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <hr v-if="can.set_application_cancelled || can.edit || can.apply" />

        <div class="tile is-parent">
          <div class="tile is-child">
            <div class="field is-grouped">
              <p class="control" v-if="!application && can.apply">
                <router-link :to="{ name: 'oms.statutory.applications.new', params: { id: event.url || event.id } }" type="submit" class="button is-warning">
                  Apply!
                </router-link>
              </p>
              <p class="control" v-if="application && can.edit_application">
                <router-link :to="{ name: 'oms.statutory.applications.edit', params: { id: event.url || event.id, application_id: application.id } }" type="submit" class="button is-warning">
                  Edit your application
                </router-link>
              </p>
              <p class="control" v-if="application && !application.cancelled && can.set_application_cancelled">
                <button class="button is-danger" @click="askSetCancelled(true)">
                  Cancel application
                </button>
              </p>
              <p class="control" v-if="application && application.cancelled && can.set_application_cancelled">
                <button class="button is-info" @click="setCancelled(false)">
                  Uncancel application
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ViewAplicationStatutory',
  data () {
    return {
      event: {
        name: null,
        questions: []
      },
      application: null,
      can: {
        edit: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    askSetCancelled (value) {
      this.$dialog.confirm({
        title: 'Cancel application',
        message: 'Are you sure you want to <b>cancel your application</b>? You can uncancel it only during application period.',
        confirmText: 'Cancel application',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.setCancelled(value)
      })
    },
    setCancelled (value) {
      this.axios.put(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + this.application.id + '/cancel', {
        cancelled: value
      }).then((response) => {
        this.application.cancelled = value
        this.$root.showInfo(value ? 'Application is cancelled.' : 'Application is uncancelled.')
      }).catch((err) => this.$root.showDanger('Could not cancel application: ' + err.message))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      this.event.application_period_starts = new Date(this.event.application_period_starts)
      this.event.application_period_ends = new Date(this.event.application_period_ends)

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + this.$route.params.application_id).then((application) => {
        this.$set(this, 'application', application.data.data)
        this.can = application.data.data.permissions

        return this.axios.get(this.services['oms-core-elixir'] + '/members/' + this.application.user_id)
      }).then((user) => {
        this.application.user = user.data.data
        this.application.body = user.data.data.bodies.find(body => body.id === this.application.body_id)
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
