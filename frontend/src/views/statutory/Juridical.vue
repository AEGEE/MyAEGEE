<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">JC listing form</div>

        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name, surname or email" />
            </div>
          </div>

          <div class="field is-grouped">
            <div class="control">
              <a @click="exportDelegatesJc()" class="button is-primary">Export all delegates for OMS JC</a>
            </div>
            <div class="control">
              <router-link :to="{ name: 'oms.statutory.votes', params: { id: this.$route.params.id } }" class="button is-primary">View amount of votes</router-link>
            </div>
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

          <b-table-column field="body_name" label="Body" centered sortable v-slot="props">
            {{ props.row.body_name }}
          </b-table-column>

          <b-table-column field="participant_type" label="Participant type and order" centered sortable v-slot="props">
            {{ props.row.participant_type && `${props.row.participant_type} (${props.row.participant_order})` }}
          </b-table-column>

          <b-table-column field="confirmed" label="Confirmed" centered sortable v-slot="props">
            {{ props.row.confirmed | beautify }}
          </b-table-column>

          <b-table-column field="registered" label="JC registered?" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingRegistered }">
              <select v-model="props.row.newRegistered" @change="switchPaxRegistered(props.row)" :disabled="props.row.departed || !props.row.confirmed">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column field="departed" label="Departed?" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingDeparted }">
              <select v-model="props.row.newDeparted" @change="switchPaxDeparted(props.row)" :disabled="!props.row.registered">
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

export default {
  name: 'JuridicalView',
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
    switchPaxRegistered (pax) {
      pax.isSavingRegistered = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/registered'

      this.axios.put(url, { registered: pax.newRegistered }).then(() => {
        pax.registered = pax.newRegistered
        pax.isSavingRegistered = false
        this.$root.showSuccess(`Successfully updated registration info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingRegistered = false
        this.$root.showError('Could not update participant registration info', err)
      })
    },
    switchPaxDeparted (pax) {
      pax.isSavingDeparted = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/departed'

      this.axios.put(url, { departed: pax.newDeparted }).then(() => {
        pax.departed = pax.newDeparted
        pax.isSavingDeparted = false
        this.$root.showSuccess(`Successfully updated departion info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingDeparted = false
        this.$root.showError('Could not update participant departion info', err)
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

        return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/juridical', { params: this.queryObject })
      }).then((application) => {
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        // Fetching users and bodies.
        for (const pax of this.applications) {
          this.$set(pax, 'newRegistered', pax.registered)
          this.$set(pax, 'newDeparted', pax.departed)
          this.$set(pax, 'isSavingRegistered', false)
          this.$set(pax, 'isSavingDeparted', false)
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
    },
    exportDelegatesJc () {
      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/export/delegates_jc', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'delegates_jc_' + new Date().toISOString() + '.csv'
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
      })
    }
  },
  mounted () {
    this.loadApplications()
  }
}
</script>
