<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Board view</div>

        <div class="field" v-if="boardBodies.length === 1">
          <label>You are currently viewing applications from </label>
          <strong>{{ boardBodies[0].name }}</strong>.
        </div>

        <div class="field" v-if="boardBodies.length > 1">
          <label>Select the body to view application from:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <font-awesome-icon icon="globe" />
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <div class="notification is-warning" v-if="selectedBody && boardBodies.length > 0">
          <p>To allow for an anonymous selection procedure, please do not provide any personal information here (like the name of the applicant).</p>
        </div>

        <b-table
          :data="applications"
          :row-class="row => calculateClassForApplication(row)"
          :loading="isLoading"
          default-sort="updated_at"
          default-sort-direction="desc"
          v-if="selectedBody && boardBodies.length > 0">
          <b-table-column field="updated_at" label="Date modified" sortable v-slot="props">
            {{ props.row.updated_at | datetime }}
          </b-table-column>

          <b-table-column field="event.name" label="Event" sortable v-slot="props">
            <router-link :to="{ name: 'oms.summeruniversity.view', params: { id: props.row.event.url } }">
              {{ props.row.event.name }}
            </router-link>
          </b-table-column>

          <b-table-column field="first_name" label="Name" sortable v-slot="props">
            <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
              {{ props.row.first_name }} {{ props.row.last_name }}
            </router-link>
          </b-table-column>

          <b-table-column label="View applications" v-slot="props">
            <button type="button" class="button" @click="showModal(props.row)">
              View application
            </button>
          </b-table-column>

          <b-table-column field="status" label="Status" sortable v-slot="props">
            <span v-if="props.row.status === 'accepted'">Accepted</span>
            <span v-if="props.row.status === 'rejected'">Rejected</span>
            <span v-if="props.row.status === 'waiting_list'">Waiting list</span>
            <span v-if="props.row.status === 'pending'">Pending</span>
          </b-table-column>

          <b-table-column field="board_comment" label="Board comment" v-slot="props">
            <textarea class="textarea" v-model="props.row.board_comment" />
          </b-table-column>

          <b-table-column label="Save" v-slot="props">
            <button type="button" class="button is-primary" @click="submitComment(props.row)">
              <span class="icon"><font-awesome-icon icon="save" /></span>
              <span>Save</span>
            </button>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import ViewParticipantModal from './ViewParticipantModal'

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
    calculateClassForApplication (pax) {
      switch (pax.status) {
      case 'accepted':
        return 'has-background-success'
      case 'rejected':
        return 'has-background-danger'
      case 'waiting_list':
        return 'has-background-warning'
      default:
        return ''
      }
    },
    submitComment (application) {
      this.axios.put(this.services['summeruniversity'] + '/single/' + application.event.id + '/applications/' + application.id + '/comment/', {
        board_comment: application.board_comment
      }).then(() => {
        this.$root.showSuccess('Participant comment is updated.')
        application.clean = true
      }).catch((err) => {
        this.$root.showError('Could not update participant comment', err)
      })
    },
    fetchData () {
      if (this.boardBodies.length === 1) {
        this.selectedBody = this.boardBodies[0].id
      }

      if (!this.selectedBody) {
        return
      }

      this.isLoading = true
      this.axios.get(this.services['summeruniversity'] + '/boardview/' + this.selectedBody).then((response) => {
        this.applications = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showError('Error fetching board view data', err)
      })
    },
    showModal (participant) {
      this.axios.get(this.services['summeruniversity'] + '/single/' + participant.event.id + '/applications/' + participant.id).then((response) => {
        this.$buefy.modal.open({
          component: ViewParticipantModal,
          hasModalCard: true,
          props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
            event: participant.event,
            participant: response.data.data
          }
        })
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    selectedBody () {
      this.fetchData()
    }
  },
  mounted () {
    this.axios.post(this.services['core'] + '/my_permissions/', {
      action: 'approve_members',
      object: 'summeruniversity'
    }).then((bodies) => {
      // Getting bodies IDs list from POST /my_permissions. Copied from statutory backend
      const boardIds = bodies.data.data.reduce((acc, val) => acc.concat(val), [])
        .filter(elt => elt.body_id)
        .map(elt => elt.body_id)
        .filter((elt, index, array) => array.indexOf(elt) === index)

      this.boardBodies = this.loginUser.bodies.filter((body) => boardIds.includes(body.id))

      if (this.boardBodies.length === 1) {
        this.selectedBody = this.boardBodies[0].id
      }
    })
  }
}
</script>
