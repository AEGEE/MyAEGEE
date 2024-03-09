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
                {{ application.body_name }}
              </router-link>
            </p>
            <p v-show="this.application.user_id !== this.loginUser.id">
              <b>Member name:</b>
              <router-link :to="{ name: 'oms.members.view', params: { id: application.user_id } }">
                {{ application.first_name }} {{ application.last_name }}
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
                <tr>
                  <th>Statutory ID</th>
                  <td>{{ application.statutory_id }}</td>
                </tr>
                <tr>
                  <th>Applied on</th>
                  <td>{{ application.created_at | datetime }}</td>
                </tr>
                <tr>
                  <th>Updated on</th>
                  <td>{{ application.updated_at | datetime }}</td>
                </tr>
                <tr>
                  <th>First name</th>
                  <td>{{ application.first_name }}</td>
                </tr>
                <tr>
                  <th>Last name</th>
                  <td>{{ application.last_name }}</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td>{{ application.gender }}</td>
                </tr>
                <tr>
                  <th>Date of birth</th>
                  <td>{{ application.date_of_birth }}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>{{ application.notification_email }}</td>
                </tr>
                <tr>
                  <th>Nationality</th>
                  <td>{{ application.nationality }}</td>
                </tr>
                <tr>
                  <th>Meals</th>
                  <td>{{ application.meals }}</td>
                </tr>
                <tr>
                  <th>Allergies</th>
                  <td>{{ application.allergies }}</td>
                </tr>
                <tr>
                  <th>Number of {{ eventTypesPlural[event.type] || 'EPM' }} visited</th>
                  <td>{{ application.number_of_events_visited | beautify }}</td>
                </tr>
                <tr>
                  <th>Visa required?</th>
                  <td>{{ application.visa_required | beautify }}</td>
                </tr>
                <tr>
                  <th>Visa passport number</th>
                  <td>{{ application.visa_passport_number }}</td>
                </tr>
                <tr>
                  <th>Visa passport issue date</th>
                  <td>{{ application.visa_passport_issue_date }}</td>
                </tr>
                <tr>
                  <th>Visa passport expiration date</th>
                  <td>{{ application.visa_passport_expiration_date }}</td>
                </tr>
                <tr>
                  <th>Visa passport issue authority</th>
                  <td>{{ application.visa_passport_issue_authority }}</td>
                </tr>
                <tr>
                  <th>Place of birth</th>
                  <td>{{ application.visa_place_of_birth }}</td>
                </tr>
                <tr>
                  <th>Street and house number</th>
                  <td>{{ application.visa_street_and_house }}</td>
                </tr>
                <tr>
                  <th>Postal code</th>
                  <td>{{ application.visa_postal_code }}</td>
                </tr>
                <tr>
                  <th>City</th>
                  <td>{{ application.visa_city }}</td>
                </tr>
                <tr>
                  <th>Country</th>
                  <td>{{ application.visa_country }}</td>
                </tr>
                <tr>
                  <th>Embassy</th>
                  <td>{{ application.visa_embassy }}</td>
                </tr>
                <tr v-for="(question, index) in event.questions" v-bind:key="index">
                  <th>{{ question.description }}</th>
                  <td class="has-text-pre-wrap" v-if="can.see_applications">{{ application.answers[index] | beautify }}</td>
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
                <!--<tr>
                  <th>Board comment</th>
                  <td v-if="application.board_comment">{{ application.board_comment }}</td>
                  <td v-if="!application.board_comment"><i>Not set yet.</i></td>
                </tr>-->
                <tr>
                  <th>Confirmed?</th>
                  <td>{{ application.confirmed | beautify }}</td>
                </tr>
                <tr>
                  <th>Attended?</th>
                  <td>{{ application.attended | beautify }}</td>
                </tr>
                <tr>
                  <th>Registered</th>
                  <td>{{ application.registered | beautify }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Application status -->
        <div class="tile is-parent" v-if="application && !application.cancelled">
          <div class="tile is-child">
            <div class="notification is-warning" v-if="application.status === 'pending'">
              Your application is recorded, please wait for the organizers to evaluate your application.
              <span v-show="can.edit_application">You can still edit it till the application period ends.</span>
            </div>
            <div class="notification is-success" v-if="application.status === 'accepted'">
              Congratulations, you have been accepted to the event!
            </div>
            <div class="notification is-warning" v-if="application.status === 'waiting_list'">
              Unfortunately you've been put to a waiting list. Please contact organizers to get more info on that.
            </div>
            <div class="notification is-danger" v-if="application.status === 'rejected'">
              Sorry, but you were not accepted to the event.
            </div>
          </div>
        </div>

        <!-- Cancellation status (if cancelled) -->
        <div class="tile is-parent" v-if="application && application.cancelled">
          <div class="tile is-child">
            <div class="notification is-danger">
              Your application is cancelled.
              <span v-if="can.set_application_cancelled">You can uncancel it till the application period ends.</span>
            </div>
          </div>
        </div>

        <!-- Explanation why you cannot apply -->
        <div class="tile is-parent" v-if="!application && !can.apply ">
          <div class="tile is-child">
            <div class="notification is-danger" v-show="new Date() < event.application_period_starts">
              You cannot apply to this event: application period hasn't started yet.
            </div>

            <div class="notification is-danger" v-show="new Date() > event.application_period_ends">
              You cannot apply to this event: application period is over.
            </div>
          </div>
        </div>

        <div class="tile is-parent" v-if="application && !application.cancelled && !can.edit_application && new Date() > event.application_period_ends">
          <div class="tile is-child">
            <div class="notification is-danger">
              You cannot edit your application anymore: application period is over.
            </div>
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <hr v-show="can.set_application_cancelled || can.edit || can.apply" />

        <div class="buttons" v-show="can.set_application_cancelled || can.edit || can.apply">
          <router-link
            :to="{ name: 'oms.statutory.applications.new', params: { id: event.url || event.id } }"
            type="submit"
            class="button is-warning"
            v-if="!application && can.apply">
            Apply!
          </router-link>

          <router-link
            :to="{ name: 'oms.statutory.applications.edit', params: { id: event.url || event.id, application_id: application.id } }"
            type="submit"
            class="button is-warning"
            v-if="application && can.edit_application">
            Edit your application
          </router-link>

          <button
            class="button is-danger"
            @click="askSetCancelled(true)"
            v-if="application && !application.cancelled && can.set_application_cancelled">
            Cancel application
          </button>

          <button
            class="button is-info"
            @click="setCancelled(false)"
            v-if="application && application.cancelled && can.set_application_cancelled">
            Uncancel application
          </button>
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
      eventTypesPlural: {
        agora: 'Agorae',
        epm: 'EPMs',
        spm: 'SPMs'
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
      this.$buefy.dialog.confirm({
        title: 'Cancel application',
        message: 'Are you sure you want to <b>cancel your application</b>? You can uncancel it only during application period.',
        confirmText: 'Cancel application',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.setCancelled(value)
      })
    },
    setCancelled (value) {
      this.axios.put(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + this.application.id + '/cancel', {
        cancelled: value
      }).then(() => {
        this.application.cancelled = value
        this.$root.showInfo(value ? 'Application is cancelled.' : 'Application is uncancelled.')
      }).catch((err) => this.$root.showError('Could not cancel application', err))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      this.event.application_period_starts = new Date(this.event.application_period_starts)
      this.event.application_period_ends = new Date(this.event.application_period_ends)

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + this.$route.params.application_id).then((application) => {
        this.$set(this, 'application', application.data.data)
        this.can = application.data.data.permissions
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        // if there's no application, just ignore, otherwise re-throw the error
        if (err.response.status !== 404) {
          throw err
        }
      })
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
