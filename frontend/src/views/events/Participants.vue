<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Applications</h1>

        <div class="field">
          <div class="control">
            <button type="button" class="button is-primary" @click="exportAll()">Export</button>
          </div>
        </div>

        <p>Total applications: {{ applications.length }}.</p>
        <p>Click on the application to extend it.</p>

        <b-table
          :data="applications"
          :row-class="row => calculateClassForApplication(row)"
          :loading="isLoading">
          <b-table-column field="user_id" label="User ID" numeric sortable v-slot="props">
            {{ props.row.user_id }}
          </b-table-column>

          <b-table-column field="first_name" label="First and last name" sortable v-slot="props">
            {{ props.row.first_name }} {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
              {{ props.row.body_name }}
            </router-link>
          </b-table-column>

          <b-table-column label="Confirmed?" field="confirmed" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingConfirmed }">
              <select :aria-label="'Confirmed for ' + props.row.first_name + ' ' + props.row.last_name" v-model="props.row.newConfirmed" @change="switchPaxConfirmed(props.row)" :disabled="props.row.attended">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Attended?" field="attended" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingAttended }">
              <select :aria-label="'Attended for ' + props.row.first_name + ' ' + props.row.last_name" v-model="props.row.newAttended" @change="switchPaxAttended(props.row)" :disabled="!props.row.confirmed">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Manage status" field="status" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSaving }">
              <select :aria-label="'Status of ' + props.row.first_name + ' ' + props.row.last_name" v-model="props.row.newStatus" @change="switchPaxStatus(props.row)">
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="View" v-slot="props">
            <button type="button" class="button is-small" :aria-label="'View the application of ' + props.row.first_name + ' ' + props.row.last_name" @click="showModal(props.row.id)">View</button>
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
    exportAll () {
      this.axios.get(this.services['events'] + '/single/' + this.$route.params.id + '/applications/export/', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'participants_' + new Date().toISOString() + '.xlsx'
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // Revoking it after the click is handled, so the download can start.
        setTimeout(() => window.URL.revokeObjectURL(url), 0)
      }).catch(async (err) => {
        // The error body is a Blob too, so reading the API's message out of it.
        if (err.response && err.response.data instanceof Blob) {
          try {
            err.response.data = JSON.parse(await err.response.data.text())
          } catch (parseError) {
            err.response.data = null
          }
        }

        this.$root.showError('Could not export participants', err)
      })
    },
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
      const url = this.services['events'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/status'

      this.axios.put(url, { status: pax.newStatus }).then(() => {
        pax.status = pax.newStatus
        pax.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for user #${pax.user_id} to "${pax.status}"`)
      }).catch((err) => {
        pax.isSaving = false
        pax.newStatus = pax.status
        this.$root.showError('Could not update participant status', err)
      })
    },
    switchPaxAttended (pax) {
      pax.isSavingAttended = true
      const url = this.services['events'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/attended'

      this.axios.put(url, { attended: pax.newAttended }).then(() => {
        pax.attended = pax.newAttended
        pax.isSavingAttended = false
        this.$root.showSuccess(`Successfully updated attendance info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingAttended = false
        pax.newAttended = pax.attended
        this.$root.showError('Could not update participant attendance info', err)
      })
    },
    switchPaxConfirmed (pax) {
      pax.isSavingConfirmed = true
      const url = this.services['events'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/confirmed'

      this.axios.put(url, { confirmed: pax.newConfirmed }).then(() => {
        pax.confirmed = pax.newConfirmed
        pax.isSavingConfirmed = false
        this.$root.showSuccess(`Successfully updated fee info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingConfirmed = false
        pax.newConfirmed = pax.confirmed
        this.$root.showError('Could not update participant fee info', err)
      })
    },
    showModal (participantId) {
      this.axios.get(this.services['events'] + '/single/' + this.event.id + '/applications/' + participantId).then((response) => {
        this.$buefy.modal.open({
          component: ViewParticipantModal,
          hasModalCard: true,
          ariaLabel: 'View participant',
          props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
            event: this.event,
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
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      return this.axios.get(this.services['events'] + '/single/' + this.$route.params.id + '/applications')
    }).then((applications) => {
      this.applications = applications.data.data

      for (const pax of this.applications) {
        this.$set(pax, 'newStatus', pax.status)
        this.$set(pax, 'newConfirmed', pax.confirmed)
        this.$set(pax, 'newAttended', pax.attended)
        this.$set(pax, 'isSaving', false)
        this.$set(pax, 'isSavingConfirmed', false)
        this.$set(pax, 'isSavingAttended', false)
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.events.list.all' })
    })
  }
}
</script>
