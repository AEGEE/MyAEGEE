<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Plenary details</div>

        <div class="content">
          <ul>
            <li><strong>Name:</strong> {{ plenary.name }}</li>
            <li><strong>Starts at:</strong> {{ plenary.starts | datetime }}</li>
            <li><strong>Ends at:</strong> {{ plenary.ends | datetime }}</li>
          </ul>
        </div>

        <form v-on:submit.prevent="addAttendance">
          <div class="field">
            <label class="label">Search by name or description</label>
            <div class="field has-addons">
              <div class="control is-expanded">
                <input class="input" type="text" v-model="applicationId" placeholder="Application ID" />
              </div>
              <div class="control">
                <input type="submit" class="button is-primary" value="Add attendance info" />
              </div>
            </div>
          </div>
        </form>

        <b-table :data="plenary.attendances" :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="application.id" label="Application ID" numeric centered>
              {{ props.row.application.id }}
            </b-table-column>

            <b-table-column field="application.first_name" label="First/last name" centered>
              {{ props.row.application.first_name }} {{ props.row.application.last_name }}
            </b-table-column>

            <b-table-column field="application.body_name" label="Body" centered>
              {{ props.row.application.body_name }}
            </b-table-column>

            <b-table-column field="starts" label="Starts" centered>
              {{ props.row.starts | datetimeseconds }}
            </b-table-column>

            <b-table-column field="starts" label="Ends" centered>
              <span v-if="props.row.ends">{{ props.row.ends | datetimeseconds }}</span>
            </b-table-column>
          </template>

          <template slot="empty">
            <section class="section">
              <div class="content has-text-grey has-text-centered">
                <p>
                  <b-icon icon="fa fa-times-circle" size="is-large"></b-icon>
                </p>
                <p>Nothing here.</p>
              </div>
            </section>
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'StatutoryPlenariesList',
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
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    addAttendance () {
      this.isSaving = false;
      this.axios.post(
        this.services['oms-statutory']
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
          this.$root.showSuccess(`Successfully marked application ${existingAttendance.application.id} as NOT presented.`)
        } else {
          // 2) if either there's no attendances for this application or all of them are closed
          this.plenary.attendances.unshift(response.data.data)
          this.$root.showSuccess(`Successfully marked application ${response.data.data.application.id} as presented.`)
        }
        this.isSaving = false
        this.applicationId = ''
      }).catch((err) => {
        this.isSaving = false
        this.applicationId = ''

        let message = (err.response && err.response.data && err.response.data.message)
          ? 'Could not mark attendance: ' + err.response.data.message
          : 'Could not mark attendance: ' + err.message

        this.$root.showDanger(message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/plenaries/' + this.$route.params.plenary_id)
    }).then((plenary) => {
      this.plenary = plenary.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
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