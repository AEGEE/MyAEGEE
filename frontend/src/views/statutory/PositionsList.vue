<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Positions list</div>

        <div class="notification is-warning">
          <div class="content">
            <p>All positions are closed two weeks before the Agora.</p>
            <p>All dates are in your local time (which is not always CET).</p>
          </div>
        </div>

        <div class="field" v-if="can.manage_candidates">
          <div class="buttons">
            <button class="button is-primary" @click="openCreatePositionModal">Create a position</button>
            <router-link
              class="button is-primary"
              :to="{ name: 'oms.statutory.candidates.export', params: { id: $route.params.id } }">
              Export candidates
            </router-link>
          </div>
        </div>

        <b-table :data="positions" :loading="isLoading" :selected.sync="selectedPosition" narrowed>
          <b-table-column field="id" label="#" numeric v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column field="starts" label="Application period starts" centered v-slot="props">
            {{ props.row.starts | datetime }}
          </b-table-column>

          <b-table-column field="starts" label="Application period ends" centered v-slot="props">
            {{ props.row.ends | datetime }}
          </b-table-column>

          <b-table-column field="places" label="Places available" centered numeric v-slot="props">
            {{ props.row.places }}
          </b-table-column>

          <b-table-column field="places" label="Applications" centered numeric v-slot="props">
            {{ props.row.candidates.length }}
          </b-table-column>

          <b-table-column field="starts" label="Status" centered v-slot="props">
            <span
              class="tag"
              v-if="prefix !== 'all'"
              :class="props.row.status === 'open' ? 'is-primary' : 'is-danger'">
              {{ props.row.status }}
            </span>
            <div v-else class="select is-small" :class="{ 'is-loading': props.row.isSaving }">
              <select v-model="props.row.newStatus" @change="switchPositionStatus(props.row)">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Edit" centered v-if="can.manage_candidates" v-slot="props">
            <a href="#" class="button is-primary is-small" @click.prevent="openEditPositionModal(props.row)">Edit</a>
          </b-table-column>

          <b-table-column label="Apply" centered v-slot="props">
            <router-link
              :to="{ name: 'oms.statutory.candidates.new', params: { id: $route.params.id, position_id: props.row.id } }"
              class="button is-small"
              v-if="props.row.status === 'open' && !props.row.myCandidate">
              Apply!
            </router-link>
            <span v-if="props.row.status !== 'open' && !props.row.myCandidate">You cannot apply.</span>

            <router-link
              :to="{ name: 'oms.statutory.candidates.edit', params: { id: $route.params.id, position_id: props.row.id, candidate_id: props.row.myCandidate.id } }"
              class="button is-small is-warning"
              v-if="props.row.myCandidate && props.row.myCandidate.status === 'pending'">
              Edit my application!
            </router-link>
            <span v-if="props.row.myCandidate && props.row.myCandidate.status !== 'pending'">You cannot edit your application.</span>
          </b-table-column>

          <b-table-column label="" centered v-if="can.manage_candidates" v-slot="props">
            <a href="#" class="button is-danger is-small" @click.prevent="askDeletePosition(props.row)">
              <span class="white"><font-awesome-icon :icon="['fa', 'trash-alt']" /></span>
            </a>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <hr v-if="selectedPosition" />

        <div class="subtitle" v-if="selectedPosition">Information about selected position</div>
        <p class="content" v-if="selectedPosition">The term for this position starts on <strong>{{ startTerm }}</strong> and ends on <strong>{{ this.selectedPosition.end_term }}</strong>.</p>
        <p class="content" v-if="selectedPosition && requirementsIsSet">This position has the following requirements associated with it:</p>
        <p class="content" v-if="selectedPosition && requirementsIsSet" v-html="$options.filters.markdown(this.selectedPosition.requirements)" />

        <hr v-if="selectedPosition" />

        <div class="subtitle" v-if="selectedPosition">Description of selected position</div>
        <p class="content" v-if="selectedPosition" v-html="$options.filters.markdown(taskDescription)" />

        <hr v-if="selectedPosition" />

        <div class="subtitle" v-if="selectedPosition">Applications for selected position</div>

        <b-table :data.sync="selectedPosition.candidates" v-if="selectedPosition" narrowed>
          <b-table-column field="id" label="#" numeric v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="first_name" label="First name" v-slot="props">
            {{ props.row.first_name }}
          </b-table-column>

          <b-table-column field="last_name" label="Last name" v-slot="props">
            {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" v-slot="props">
            {{ props.row.body_name }}
          </b-table-column>

          <b-table-column field="created_at" label="Applied on" v-slot="props">
            {{ props.row.created_at | datetimeseconds }}
          </b-table-column>

          <b-table-column field="email" label="Email" :visible="prefix === 'all'" v-slot="props">
            {{ props.row.notification_email }}
          </b-table-column>

          <b-table-column label="View" v-slot="props">
            <a
              v-if="props.row.status === 'approved' || prefix === 'all'"
              href="#"
              @click.prevent="openViewCandidateModal(props.row, selectedPosition)">
              View
            </a>
          </b-table-column>

          <b-table-column label="Edit" :visible="prefix === 'all'" v-slot="props">
            <router-link
              :to="{ name: 'oms.statutory.candidates.edit', params: { id: $route.params.id, position_id: selectedPosition.id, candidate_id: props.row.id } }">
              Edit
            </router-link>
          </b-table-column>

          <b-table-column label="Update status" :visible="prefix === 'all'" v-slot="props">
            <div class="select is-small" :class="{ 'is-loading': props.row.isSaving }">
              <select v-model="props.row.newStatus" @change="switchCandidateStatus(props.row, selectedPosition)">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
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
import moment from 'moment'
import EditPositionModal from './EditPositionModal'
import ViewCandidateModal from './ViewCandidateModal'

export default {
  name: 'StatutoryPositionsList',
  data () {
    return {
      positions: [],
      myCandidates: [],
      selected: null,
      event: {},
      selectedPosition: null,
      can: {
        manage_candidates: false
      },
      bodies: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    prefix () {
      return this.$route.params.prefix
    },
    taskDescription () {
      if (!this.selectedPosition || !this.selectedPosition.body_id) {
        return 'A description for this position has not been set.'
      }

      const body = this.bodies.find(bod => bod.id === this.selectedPosition.body_id)
      return body.task_description
    },
    startTerm () {
      return moment(this.selectedPosition.start_term).format('YYYY-MM-DD')
    },
    requirementsIsSet () {
      return (this.selectedPosition.requirements !== null && this.selectedPosition.requirements !== '')
    }
  },
  methods: {
    openCreatePositionModal () {
      const closeDeadline = moment(this.event.starts)
        .subtract(2, 'week')
        .endOf('day')
        .toDate()

      this.$buefy.modal.open({
        component: EditPositionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          position: {
            start_term: new Date(),
            starts: new Date(),
            ends: closeDeadline,
            name: '',
            places: 1
          },
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router,
          bodies: this.bodies
        }
      })
    },
    openEditPositionModal (position) {
      this.$buefy.modal.open({
        component: EditPositionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          position,
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router,
          bodies: this.bodies
        }
      })
    },
    openViewCandidateModal (candidate, position) {
      this.$buefy.modal.open({
        component: ViewCandidateModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          position,
          candidate,
          event: this.event,
          services: this.services
        }
      })
    },
    deletePosition (position) {
      this.isLoading = true
      this.axios.delete(
        this.services['statutory'] + '/events/' + this.$route.params.id + '/positions/' + position.id
      ).then(() => {
        const index = this.positions.indexOf(position)
        this.positions.splice(index, 1)
        this.selectedPosition = null
        this.isLoading = false
        this.$root.showSuccess('Position is removed.')
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not remove position', err)
      })
    },
    askDeletePosition (position) {
      this.$buefy.dialog.confirm({
        title: 'Removing position',
        message: 'Are you sure you want to remove the position for <b>' + position.name + '</b>? This action cannot be undone.',
        confirmText: 'Remove position',
        type: 'is-danger',
        hasIcon: false,
        onConfirm: () => this.deletePosition(position)
      })
    },
    switchCandidateStatus (candidate, position) {
      candidate.isSaving = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/status'

      this.axios.put(url, { status: candidate.newStatus }).then(() => {
        candidate.status = candidate.newStatus
        candidate.isSaving = false
        this.$root.showSuccess(`Successfully updated status of candidature for user #${candidate.user_id} to "${candidate.status}"`)
      }).catch((err) => {
        candidate.isSaving = false
        this.$root.showError('Could not update candidature status', err)
      })
    },
    switchPositionStatus (position) {
      position.isSaving = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/positions/' + position.id + '/status'

      this.axios.put(url, { status: position.newStatus }).then(() => {
        position.status = position.newStatus
        position.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for position "${position.name}" to ${position.status}.`)
      }).catch((err) => {
        position.isSaving = false
        this.$root.showError('Could not update participant status', err)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['core'] + '/bodies').then((bodiesResponse) => {
      this.bodies = bodiesResponse.data.data
    })

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/positions/' + this.prefix)
    }).then((positionResponse) => {
      for (const position of positionResponse.data.data) {
        position.isSaving = false
        position.newStatus = position.status

        for (const candidate of position.candidates) {
          candidate.isSaving = false
          candidate.newStatus = candidate.status
        }
      }

      this.positions = positionResponse.data.data

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/positions/candidates/mine')
    }).then((myCandidates) => {
      this.myCandidates = myCandidates.data.data

      for (const candidate of this.myCandidates) {
        const position = this.positions.find(pos => pos.id === candidate.position_id)
        if (position) {
          this.$set(position, 'myCandidate', candidate)
        }
      }

      this.isLoading = false
    })
      .catch((err) => {
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

<style>
.table-wrapper .table .button:not(.is-primary) {
  color: #000;
}
.table-wrapper .table .is-selected .button, .table-wrapper .table .is-selected .tag {
  border: 1px solid white;
}

.white {
  color: white;
}
</style>
