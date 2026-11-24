<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Plenary details</h1>

        <div class="content">
          <ul>
            <li><strong>Name:</strong> {{ plenary.name }}</li>
            <li><strong>Starts at:</strong> {{ plenary.starts | datetime }}</li>
            <li><strong>Ends at:</strong> {{ plenary.ends | datetime }}</li>
          </ul>
        </div>

        <form v-on:submit.prevent="addAttendance">
          <div class="field">
            <label class="label" for="plenary-application-id">Application ID or statutory ID</label>
            <div class="field has-addons">
              <div class="control is-expanded">
                <input id="plenary-application-id" class="input" type="text" v-model="applicationId" placeholder="Application ID" />
              </div>
              <div class="control">
                <input type="submit" class="button is-primary" value="Add attendance info" :disabled="isSaving" />
              </div>
            </div>
          </div>
        </form>

        <b-table :data="plenary.attendances" :loading="isLoading">
          <b-table-column field="id" label="#" numeric v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="application.id" label="Application ID" numeric centered v-slot="props">
            {{ props.row.application.id }}
          </b-table-column>

          <b-table-column field="application.first_name" label="First/last name" centered v-slot="props">
            {{ props.row.application.first_name }} {{ props.row.application.last_name }}
          </b-table-column>

          <b-table-column field="application.body_name" label="Body" centered v-slot="props">
            {{ props.row.application.body_name }}
          </b-table-column>

          <b-table-column field="starts" label="Starts" centered v-slot="props">
            {{ props.row.starts | datetimeseconds }}
          </b-table-column>

          <b-table-column field="starts" label="Ends" centered v-slot="props">
            <span v-if="props.row.ends">{{ props.row.ends | datetimeseconds }}</span>
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

export default {
  name: 'StatutoryViewPlenary',
  data () {
    return {
      plenary: {
        id: null,
        starts: null,
        ends: null,
        name: '',
        attendances: []
      },
      event: {},
      applicationId: '',
      can: {
        mark_attendance: false
      },
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
    })
  },
  methods: {
    addAttendance () {
      // The button is disabled meanwhile, so Enter doesn't mark the same member in and out.
      this.isSaving = true
      this.axios.post(
        this.services['statutory']
          + '/events/' + this.$route.params.id
          + '/plenaries/' + this.$route.params.plenary_id
          + '/attendance/mark',
        { application_id: this.applicationId }
      ).then((response) => {
        const existingAttendance = this.plenary.attendances.find(attendance => attendance.id === response.data.data.id)

        // 2 cases:
        if (existingAttendance) {
          // 1) there is unclosed attendance, then updating it
          existingAttendance.ends = response.data.data.ends
          this.$root.showSuccess(`Successfully marked application ${existingAttendance.application.id} as left.`)
        } else {
          // 2) if either there's no attendances for this application or all of them are closed
          this.plenary.attendances.unshift(response.data.data)
          this.$root.showSuccess(`Successfully marked application ${response.data.data.application.id} as present.`)
        }
        this.isSaving = false
        this.applicationId = ''
      }).catch((err) => {
        this.isSaving = false
        this.applicationId = ''
        this.$root.showError('Could not mark attendance', err)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/plenaries/' + this.$route.params.plenary_id)
    }).then((plenary) => {
      this.plenary = plenary.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        // The event is there once it is loaded, so the plenary isn't.
        this.$root.showError(this.event.id ? 'Plenary is not found' : 'Event is not found')
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
</style>
