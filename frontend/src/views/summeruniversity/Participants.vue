<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Applications</div>

        <div class="notification is-info">
          <div class="content">
            <p>On this page you can see the applications to your SU. There are various columns that you can use as organizer:</p>
            <p>The column 'Manage status' is used to accept or reject participants.</p>
            <p>The column 'Cancelled?' can be used to cancel participants after they have been accepted. Some applications might have been cancelled, this can also be done by the person that has applied before the application period ended.</p>
            <p>The column 'Confirmed?' can be used to keep track of the participants that have confirmed their participation. By updating this, SUCT can also see how many participants have already been confirmed.</p>
            <p>The column 'Attended?' can be used for confirmed participants for when they have attended your SU. This helps SUCT to see how many people participated in this year's SUs.</p>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <button class="button is-primary" @click="exportAll()">Export pending and accepted participants</button>
          </div>
        </div>

        <div class="notification is-warning">
          <div class="content">
            <p>The export above will not export visa information due to privacy concerns. That information can only be viewed on this page.</p>
          </div>
        </div>

        <p>Total applications: {{ applications.length }}.</p>
        <p>Click on the application to extend it.</p>

        <b-table
          :data="applications"
          :row-class="row => calculateClassForApplication(row)"
          :loading="isLoading">
          <b-table-column field="first_name" label="First and last name" sortable v-slot="props">
            {{ props.row.first_name }} {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
              {{ props.row.body_name }}
            </router-link>
          </b-table-column>

          <b-table-column label="View" v-slot="props">
            <a href="#" @click.prevent="showModal(props.row.id)">View</a>
          </b-table-column>

          <b-table-column label="Manage status" field="status" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSaving }">
              <select v-model="props.row.newStatus" @change="switchPaxStatus(props.row)">
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Cancelled?" field="cancelled" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingCancelled }">
              <select v-model="props.row.newCancelled" @change="switchPaxCancelled(props.row)" :disabled="props.row.cancelled">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Confirmed?" field="confirmed" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingConfirmed }">
              <select v-model="props.row.newConfirmed" @change="switchPaxConfirmed(props.row)" :disabled="props.row.attended">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Attended?" field="attended" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingAttended }">
              <select v-model="props.row.newAttended" @change="switchPaxAttended(props.row)" :disabled="!props.row.confirmed">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
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
      this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications/export/', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'participants_' + this.event.name + '_' + new Date().toISOString() + '.xlsx'
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
      })
    },
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
    switchPaxStatus (pax) {
      pax.isSaving = true
      const url = this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/status'

      this.axios.put(url, { status: pax.newStatus }).then(() => {
        pax.status = pax.newStatus
        pax.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for user #${pax.user_id} to "${pax.status}"`)
      }).catch((err) => {
        pax.isSaving = false
        this.$root.showError('Could not update participant status', err)
      })
    },
    switchPaxCancelled (pax) {
      pax.isSavingCancelled = true
      const url = this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/cancelled'

      this.axios.put(url, { cancelled: pax.newCancelled }).then(() => {
        pax.cancelled = pax.newCancelled
        pax.isSavingCancelled = false
        this.$root.showSuccess(`Successfully updated attendance info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingCancelled = false
        this.$root.showError('Could not update participant attendance info', err)
      })
    },
    switchPaxAttended (pax) {
      pax.isSavingAttended = true
      const url = this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/attended'

      this.axios.put(url, { attended: pax.newAttended }).then(() => {
        pax.attended = pax.newAttended
        pax.isSavingAttended = false
        this.$root.showSuccess(`Successfully updated attendance info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingAttended = false
        this.$root.showError('Could not update participant attendance info', err)
      })
    },
    switchPaxConfirmed (pax) {
      pax.isSavingConfirmed = true
      const url = this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications/' + pax.id + '/confirmed'

      this.axios.put(url, { confirmed: pax.newConfirmed }).then(() => {
        pax.confirmed = pax.newConfirmed
        pax.isSavingConfirmed = false
        this.$root.showSuccess(`Successfully updated fee info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingConfirmed = false
        this.$root.showError('Could not update participant fee info', err)
      })
    },
    showModal (participantId) {
      this.axios.get(this.services['summeruniversity'] + '/single/' + this.event.id + '/applications/' + participantId).then((response) => {
        this.$buefy.modal.open({
          component: ViewParticipantModal,
          hasModalCard: true,
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
  filters: {
    capitalize (value) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions

      return this.axios.get(this.services['summeruniversity'] + '/single/' + this.$route.params.id + '/applications')
    }).then((applications) => {
      this.applications = applications.data.data

      for (const pax of this.applications) {
        this.$set(pax, 'newStatus', pax.status)
        this.$set(pax, 'newCancelled', pax.cancelled)
        this.$set(pax, 'newConfirmed', pax.confirmed)
        this.$set(pax, 'newAttended', pax.attended)
        this.$set(pax, 'isSaving', false)
        this.$set(pax, 'isSavingCancelled', false)
        this.$set(pax, 'isSavingConfirmed', false)
        this.$set(pax, 'isSavingAttended', false)
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.summeruniversity.list' })
    })
  }
}
</script>
