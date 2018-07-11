<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Board-view</div>

        <div class="field">
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

        <div class="subtitle" v-if="!selectedBody">You haven't selected the antenna yet.</div>

        <table class="table is-narrow is-fullwidth" v-if="selectedBody">
          <thead>
            <tr>
              <th>Date modified</th>
              <th>Event</th>
              <th>Name</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(application, index) in applications" v-bind:key="index">
              <td>{{ application.updatedAt }}</td>
              <td>
                <router-link :to="{ name: 'oms.events.view', params: { id: application.url } }">
                  {{ application.name }}
                </router-link>
              </td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: application.user_id } }">
                  {{ application.user ? application.user.first_name + ' ' + application.user.last_name : 'Loading...' }}
                </router-link>
              </td>
              <td class="field">
                <div class="control">
                  <input class="input" v-model="application.board_comment" />
                </div>
              </td>
              <td>
                <button type="button" class="button is-primary" @click="submitComment(application)">
                  <span class="icon"><i class="fa fa-floppy-o"></i></span>
                  <span>Save</span>
                </button>
              </td>
            </tr>
            <tr v-if="isLoading" colspan="5">Loading...</tr>
            <tr v-if="!isLoading && applications.length === 0" colspan="5">No applications from this antenna.</tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BoardView',
  data () {
    return {
      applications: [],
      boardBodies: [],
      isLoading: false,
      selectedBody: null
    }
  },
  methods: {
    submitComment (application) {
      this.axios.put(this.services['oms-events'] + '/single/' + application.url + '/participants/' + application.application_id + '/comment/', {
        board_comment: application.board_comment
      }).then(() => {
        this.$toast.open({
          message: 'Participant comment is updated.',
          type: 'is-success'
        })
        application.clean = true
      }).catch((err) => {
        let message = 'Could not update participant comment: ' + err.message

        this.$toast.open({
          duration: 3000,
          message,
          type: 'is-danger'
        })
      })
    },
    fetchData () {
      if (!this.selectedBody) {
        return
      }

      this.isLoading = true
      this.axios.get(this.services['oms-events'] + '/boardview/' + this.selectedBody).then((response) => {
        this.applications = response.data.data

        for (const pax of this.applications) {
          this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((response) => {
            pax.user = response.data.data
            this.$forceUpdate()
          }).catch(console.error)
        }

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$toast.open({
          duration: 3000,
          message: 'Error fetching board view data: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    'selectedBody' () {
      this.fetchData()
    }
  },
  mounted () {
    this.boardBodies = this.loginUser.bodies.filter((body) =>
      this.loginUser.circles.some(circle => circle.body_id === body.id && circle.name.toLowerCase().includes('board')))
  }
}
</script>
