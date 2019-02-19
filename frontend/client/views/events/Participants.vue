<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Applications</div>

        <div class="field">
          <div class="control">
            <button class="button is-primary" @click="exportAll()">Export</button>
          </div>
        </div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Body</th>
              <th v-if="can.approve_participants">Status</th>
              <th v-if="can.approve_participants"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in applications" v-bind:key="pax.user_id">
              <td>{{ pax.user_id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.first_name }} {{ pax.last_name }}
                </router-link>
              </td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: pax.body_id } }">
                  {{ pax.body_name }}
                </router-link>
              </td>
              <td v-if="can.approve_participants">
                <span>{{ pax.status | capitalize }}</span>
              </td>
              <td>
                <button class="button is-small is-primary" @click="showModal(pax)">
                  <i class="fa fa-pencil-alt"></i>
                </button>
              </td>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td colspan="4">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="4">Loading...</td>
            </tr>
          </tbody>
        </table>

        <div class="tile is-parent" v-if="selected">
          <div class="tile is-child">
            <div class="title">Selected participant</div>
            <table class="table is-narrow is-fullwidth">
              <tr>
                <td><b>First Name</b></td>
                <td>{{ selected.first_name }}</td>
              </tr>

              <tr>
                <td><b>Last Name</b></td>
                <td>{{ selected.last_name }}</td>
              </tr>

              <tr>
                <td><b>Body</b></td>
                <td>{{ selected.body_name }}</td>
              </tr>

              <tr>
                <td><b>Application date</b></td>
                <td>{{ selected.createdAt | date }}</td>
              </tr>

              <tr v-for="(field, index) in event.questions" v-bind:key="index">
                <td><b>{{ field.description }}</b></td>
                <td>{{ selected.answers[index] | beautify }}</td>
              </tr>

              <tr>
                <td><b>Board comment</b></td>
                <td v-show="selected.board_comment">{{ selected.board_comment }}</td>
                <td v-show="!selected.board_comment">-</td>
              </tr>
            </table>

            <div class="field">
              <button class="button is-danger" @click="changeState(selected, 'rejected')">
                <span class="icon">
                  <i class="fa fa-minus-circle"></i>
                </span>
                <span>Reject</span>
              </button>
              <button class="button is-primary" @click="changeState(selected, 'accepted')">
                <span class="icon">
                  <i class="fa fa-plus-circle"></i>
                </span>
                <span>Accept</span>
              </button>
              <button class="button" @click="changeState(selected, 'pending')">
                <span class="icon">
                  <i class="fa fa-circle-notch"></i>
                </span>
                <span>Postpone</span>
              </button>
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
  name: 'ParticipantsList',
  data () {
    return {
      event: {
        name: null,
        questions: []
      },
      can: {
        approve_participants: false
      },
      applications: [],
      isLoading: false,
      isSaving: false,
      selected: null
    }
  },
  methods: {
    exportAll (prefix) {
      this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id + '/applications/export/', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'participants.xlsx')
        document.body.appendChild(link)
        link.click()
      })
    },
    showModal (application) {
      this.selected = application
    },
    changeState (application, newState) {
      // Store the change
      this.axios.put(this.services['oms-events'] + '/single/' + this.$route.params.id + '/applications/' + application.id + '/status/', {
        status: newState
      }).then(() => {
        application.status = newState
        this.selected = null

        this.$root.showSuccess('Participant status is updated.')
      }).catch((err) => {
        this.$root.showDanger('Could not update participant status: ' + err.message)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  filters: {
    capitalize (value) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      return this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id + '/applications')
    }).then((applications) => {
      this.applications = applications.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
