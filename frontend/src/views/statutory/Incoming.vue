<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Incoming</div>

        <div class="field">
          <label class="label">Search by name or statutory ID (search by email is currently broken but will return)</label>
          <div class="control is-expanded">
            <input class="input" type="text" v-model="query" placeholder="Search by name, surname or statutory ID" />
          </div>
        </div>

        <div>Total participants: {{ total }}</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          paginated
          backend-pagination
          :total="total"
          :per-page="limit"
          @page-change="onPageChange"
          backend-sorting
          default-sort="statutory_id"
          default-sort-direction="desc"
          @sort="onSort">
          <b-table-column field="statutory_id" label="#" numeric sortable v-slot="props">
            {{ props.row.statutory_id }}
          </b-table-column>

          <b-table-column field="user_id" label="User ID" sortable v-slot="props">
            {{ props.row.user_id }}
          </b-table-column>

          <b-table-column field="first_name" label="First name" centered sortable v-slot="props">
            {{ props.row.first_name | beautify }}
          </b-table-column>

          <b-table-column field="last_name" label="Last name" centered sortable v-slot="props">
            {{ props.row.last_name | beautify }}
          </b-table-column>

          <b-table-column field="email" label="Email" centered sortable v-slot="props">
            {{ props.row.notification_email }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" centered sortable v-slot="props">
            {{ props.row.body_name }}
          </b-table-column>

          <b-table-column field="meals" label="Meals" centered sortable v-slot="props">
            {{ props.row.meals }}
          </b-table-column>

          <b-table-column field="allergies" label="Allergies" centered sortable v-slot="props">
            {{ props.row.allergies }}
          </b-table-column>

          <b-table-column field="confirmed" label="Confirmed?" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingConfirmed }">
              <select v-model="props.row.newConfirmed" @change="switchPaxConfirmed(props.row)" :disabled="props.row.attended">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column field="incoming" label="Incoming form filled?" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingIncoming }">
              <select v-model="props.row.newIncoming" @change="switchPaxIncoming(props.row)" :disabled="props.row.attended">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column field="attended" label="Attended?" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingAttended }">
              <select v-model="props.row.newAttended" @change="switchPaxAttended(props.row)" :disabled="!props.row.confirmed">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="View" centered v-slot="props">
            <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.statutory_id || props.row.id } }">
              View
            </router-link>
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
  name: 'StatutoryIncoming',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      query: '',
      limit: 50,
      offset: 0,
      total: 0,
      sort: {
        field: 'id',
        direction: 'desc'
      },
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset,
        sort: this.sort
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    }
  },
  watch: {
    query () {
      this.loadApplications()
    }
  },
  methods: {
    switchPaxAttended (pax) {
      pax.isSavingAttended = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/attended'

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
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/confirmed'

      this.axios.put(url, { confirmed: pax.newConfirmed }).then(() => {
        pax.confirmed = pax.newConfirmed
        pax.isSavingConfirmed = false
        this.$root.showSuccess(`Successfully updated fee info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingConfirmed = false
        this.$root.showError('Could not update participant fee info', err)
      })
    },
    switchPaxIncoming (pax) {
      pax.isSavingIncoming = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/incoming'

      this.axios.put(url, { incoming: pax.newIncoming }).then(() => {
        pax.incoming = pax.newIncoming
        pax.isSavingIncoming = false
        this.$root.showSuccess(`Successfully updated incoming info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingIncoming = false
        this.$root.showError('Could not update participant incoming info', err)
      })
    },
    onPageChange (page) {
      this.offset = (page - 1) * this.limit
      this.loadApplications()
    },
    onSort (field, order) {
      this.sort = { field, order }
      this.loadApplications()
    },
    loadApplications () {
      this.isLoading = true

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
        this.event = event.data.data

        return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/incoming', { params: this.queryObject })
      }).then((application) => {
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        // Fetching users and bodies.
        for (const pax of this.applications) {
          this.$set(pax, 'newConfirmed', pax.confirmed)
          this.$set(pax, 'newIncoming', pax.incoming)
          this.$set(pax, 'newAttended', pax.attended)
          this.$set(pax, 'isSavingConfirmed', false)
          this.$set(pax, 'isSavingIncoming', false)
          this.$set(pax, 'isSavingAttended', false)
        }
      }).catch((err) => {
        this.isLoading = false
        if (err.response.status === 404) {
          this.$root.showError('Event is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }

        this.$router.push({ name: 'oms.statutory.list.all' })
      })
    }
  },
  mounted () {
    this.loadApplications()
  }
}
</script>
