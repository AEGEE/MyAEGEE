<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Board view</div>

        <div class="field" v-if="boardBodies.length > 0">
          <label>Select the body to view application from:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <i class="fa fa-globe"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <table class="table is-narrow is-fullwidth" v-if="selectedBody">
          <thead>
            <tr>
              <th>#</th>
              <th>Name and surname</th>
              <th v-for="(question, index) in event.questions" v-bind:key="index">{{ question }}</th>
              <th>Participant type</th>
              <th>Board comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in applications" v-bind:key="pax.user_id">
              <td>{{ pax.id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.user ? pax.user.first_name + ' ' + pax.user.last_name: 'Loading...' }}
                </router-link>
              </td>
              <td v-for="(answer, index) in pax.answers" v-bind:key="index">{{ answer }}</td>
              <td>
                <div class="select">
                  <select v-model="pax.participant_type" @change="pax.saved = false">
                    <option value="delegate">Delegate</option>
                    <option value="visitor">Visitor</option>
                    <option value="envoy">Envoy</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>
              </td>
              <td>
                <textarea class="textarea" v-model="pax.board_comment" @change="pax.saved = false" />
              </td>
              <th>
                <button class="button is-success" :disabled="!pax.saved" @click="updateParticipant(pax)">Save!</button>
              </th>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td :colspan="4 + event.questions.length">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="4 + event.questions.length">Loading...</td>
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
  name: 'StatutoryBoardView',
  data () {
    return {
      applications: [],
      boardBodies: [],
      myBoards: [],
      selectedBody: null,
      event: {
        questions: []
      },
      can: {
        see_boardview_of: {}
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
    updateParticipant (pax) {
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/board'

      this.axios.put(url, { participant_type: pax.participant_type, board_comment: pax.board_comment }).then(() => {
        pax.saved = true
        this.$root.showSuccess('Participant is successfully updated.')
      }).catch((err) => {
        this.$root.showDanger('Could not update participant: ' + err.message)
      })
    },
    fetchBoardview () {
      this.isLoading = true
      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/boardview/' + this.selectedBody).then((application) => {
        this.applications = application.data.data
        this.isLoading = false

        // Fetching users and bodies.
        for (const pax of this.applications) {
          pax.saved = true

          this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((user) => {
            const member = user.data.data
            pax.user = member
            pax.body = member.bodies.find(body => body.id === pax.body_id)

            this.$forceUpdate()
          }).catch(console.error)
        }
      }).catch((err) => {
        this.isLoading = false

        this.$root.showDanger('Could not fetch boardview: ' + err.message)
      })
    }
  },
  watch: {
    'selectedBody' () {
      this.fetchBoardview()
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_boardview_of).filter(key => this.can.see_boardview_of[key])
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      for (const bodyId of this.myBoards) {
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + bodyId).then((body) => {
          this.boardBodies.push(body.data.data)
        })
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
