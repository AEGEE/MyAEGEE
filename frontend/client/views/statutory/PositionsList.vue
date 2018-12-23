<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Positions list</div>

        <div class="field" v-if="can.manage_candidates">
          <div class="control">
            <button class="button is-primary" @click="openCreatePositionModal">Create a position</button>
          </div>
        </div>

        <b-table :data="positions" :loading="isLoading" :selected.sync="selectedPosition">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="name" label="Name">
              {{ props.row.name }}
            </b-table-column>

            <b-table-column field="starts" label="Application period starts" centered>
              {{ props.row.starts | datetime }}
            </b-table-column>

            <b-table-column field="starts" label="Application period ends" centered>
              {{ props.row.ends | datetime }}
            </b-table-column>

            <b-table-column field="places" label="Places available" centered numeric>
              {{ props.row.places }}
            </b-table-column>

            <b-table-column field="places" label="Applications" centered numeric>
              {{ props.row.candidates.length }}
            </b-table-column>

            <b-table-column field="starts" label="Status" centered>
              <span class="tag" :class="props.row.status === 'open' ? 'is-primary' : 'is-danger'">{{ props.row.status }}</span>
            </b-table-column>

            <b-table-column label="Edit" centered v-if="can.manage_candidates">
              <a href="#" class="button is-primary is-small" @click.prevent="openEditPositionModal(props.row)">Edit</a>
            </b-table-column>

            <b-table-column label="Apply" centered>
              <router-link
                :to="{ name: 'oms.statutory.candidates.new', params: { id: $route.params.id, position_id: props.row.id } }"
                class="button is-small"
                v-if="props.row.status === 'open' && !props.row.myCandidate">
                Apply!
              </router-link>
              <router-link
                :to="{ name: 'oms.statutory.candidates.edit', params: { id: $route.params.id, position_id: props.row.id, candidate_id: props.row.myCandidate.id } }"
                class="button is-small is-warning"
                v-if="props.row.status === 'open' && props.row.myCandidate">
                Edit my application!
              </router-link>
              <span v-if="props.row.status !== 'open'">You cannot apply.</span>
            </b-table-column>
          </template>
        </b-table>

        <div class="subtitle" v-if="selectedPosition">Applications for selected position</div>

        <table class="table is-narrow is-fullwidth" v-if="selectedPosition">
          <thead>
            <tr>
              <th>#</th>
              <th>First name</th>
              <th>Last name</th>
              <th>Body</th>
              <th>View</th>
              <th v-if="prefix === 'all'">Update status</th>
            </tr>
          </thead>
          <thead>
            <tr v-for="candidate in selectedPosition.candidates" v-bind:key="candidate.id">
              <td>{{ candidate.id }}</td>
              <td v-if="candidate.status === 'approved' || prefix === 'all'">{{ candidate.first_name }}</td>
              <td v-if="candidate.status === 'approved' || prefix === 'all'">{{ candidate.last_name }}</td>
              <td v-if="candidate.status === 'approved' || prefix === 'all'">{{ candidate.body_name }}</td>
              <td v-if="candidate.status === 'approved' || prefix === 'all'">
                <a href="#" @click.prevent="openViewCandidateModal(candidate, selectedPosition)">View</a>
              </td>
              <td v-if="candidate.status !== 'approved' && prefix === 'approved'" colspan="4">This application is not approved yet.</td>
              <td v-if="prefix === 'all'">
                <div class="select" :class="{ 'is-loading': candidate.isSaving }">
                  <select v-model="candidate.newStatus" @change="switchCandidateStatus(candidate, selectedPosition)">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </td>
            </tr>
            <tr v-if="selectedPosition.candidates.length === 0">
              <td colspan="5">No applications yet!</td>
            </tr>
          </thead>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
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
    }
  },
  methods: {
    openCreatePositionModal () {
      this.$modal.open({
        component: EditPositionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          position: {
            starts: new Date(),
            ends: new Date(),
            name: '',
            places: 1
          },
          event: this.event,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    openEditPositionModal (position) {
      this.$modal.open({
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
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    openViewCandidateModal (candidate, position) {
      this.$modal.open({
        component: ViewCandidateModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          position,
          candidate,
          event: this.event
        }
      })
    },
    switchCandidateStatus (candidate, position) {
      candidate.isSaving = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/' + position.id + '/candidates/' + candidate.id + '/status'

      this.axios.put(url, { status: candidate.newStatus }).then(() => {
        candidate.status = candidate.newStatus
        candidate.isSaving = false
        this.$root.showSuccess(`Successfully updated status of candidature for user #${candidate.user_id} to "${candidate.status}"`)
      }).catch((err) => {
        candidate.isSaving = false
        this.$root.showDanger('Could not update candidature status: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/' + this.prefix)
    }).then((position) => {
      this.positions = position.data.data

      for (const position of this.positions) {
        for (const candidate of position.candidates) {
          this.$set(candidate, 'isSaving', false)
          this.$set(candidate, 'newStatus', candidate.status)
        }
      }

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/candidates/mine')
    }).then((myCandidates) => {
      this.myCandidates = myCandidates.data.data

      for (const candidate of this.myCandidates) {
        const position = this.positions.find(pos => pos.id === candidate.position_id)
        if (position) {
          this.$set(position, 'myCandidate', candidate)
        }
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
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
</style>