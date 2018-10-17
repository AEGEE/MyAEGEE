<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Manage applications</div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>#</th>
              <th>User ID</th>
              <th>Body</th>
              <th>Participant type</th>
              <th>Board comment</th>
              <th v-for="(question, index) in event.questions" v-bind:key="index">{{ question }}</th>
              <th></th>
              <th>Manage status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in applications" v-bind:key="pax.user_id" :class="calculateClassForApplication(pax)">
              <td>{{ pax.id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.user_id }}
                </router-link>
              </td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: pax.body_id } }">
                  {{ pax.body ? pax.body.name : 'Loading...' }}
                </router-link>
              </td>
              <td v-if="pax.participant_type">{{ pax.participant_type }}</td>
              <td v-if="!pax.participant_type"><i>Not set.</i></td>
              <td v-if="pax.board_comment">{{ pax.board_comment }}</td>
              <td v-if="!pax.board_comment"><i>Not set.</i></td>
              <td v-for="(answer, index) in pax.answers" v-bind:key="index">{{ answer }}</td>
              <td>
                <router-link :to="{ name: 'oms.statutory.manage_application', params: { application_id: pax.id } }">
                  Edit
                </router-link>
              </td>
              <th>
                <div class="select" :class="{ 'is-loading': pax.isSaving }">
                  <select v-model="pax.newStatus" @change="switchPaxStatus(pax)">
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </th>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td :colspan="7 + event.questions.length">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="7 + event.questions.length">Loading...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AcceptParticipantsStatutoryList',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      isLoading: false,
      isSaving: false
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  methods: {
    calculateClassForApplication (pax) {
      switch (pax.status) {
        case 'accepted':
          return 'has-background-success'
        case 'rejected':
          return 'has-background-danger'
        default:
          return ''
      }
    },
    switchPaxStatus (pax) {
      pax.isSaving = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/status'

      this.axios.put(url, { status: pax.newStatus }).then(() => {
        pax.status = pax.newStatus
        pax.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for user #${pax.user_id} to "${pax.status}"`)
      }).catch((err) => {
        pax.isSaving = false
        this.$root.showDanger('Could not update participant status: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/all')
    }).then((application) => {
      this.applications = application.data.data
      this.isLoading = false

      // Fetching users and bodies.
      for (const pax of this.applications) {
        pax.newStatus = pax.status
        pax.isSaving = false

        this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((user) => {
          const member = user.data.data
          pax.user = member
          pax.body = member.bodies.find(body => body.id === pax.body_id)

          this.$forceUpdate()
        }).catch(console.error)
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
