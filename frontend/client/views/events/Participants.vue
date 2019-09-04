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

        <p>Total applications: {{ applications.length }}.</p>
        <p>Click on the application to extend it.</p>

        <b-table
          :data="applications"
          :loading="isLoading"
          @click="showModal">
          <template slot-scope="props">
            <b-table-column field="user_id" label="User ID" numeric sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="first_name" label="First and last name" sortable>
              {{ props.row.first_name }} {{ props.row.last_name }}
            </b-table-column>

            <b-table-column field="body_name" label="Body">
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
                {{ props.row.body_name }}
              </router-link>
            </b-table-column>

            <b-table-column label="Status" :visible="can.approve_participants">
              {{ props.row.status | capitalize }}
            </b-table-column>
          </template>

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
      isLoading: false
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
    showModal (participant) {
      this.$buefy.modal.open({
        component: ViewParticipantModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          event: this.event,
          participant,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
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
