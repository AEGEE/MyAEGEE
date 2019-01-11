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
            <div class="control">
              <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
              <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled and accepted applications</button>
            </div>
          </div>
        </div>

        <b-table
          :data="filteredApplications"
          :loading="isLoading"
          paginated
          :per-page="limit"
          default-sort="id"
          default-sort-direction="desc">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="user_id" label="User ID" sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="first_name" label="First name" centered sortable>
              {{ props.row.first_name | beautify }}
            </b-table-column>

            <b-table-column field="last_name" label="Last name" centered sortable>
              {{ props.row.last_name | beautify }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" centered sortable>
              {{ props.row.body_name }}
            </b-table-column>

            <b-table-column field="participant_type" label="Participant type and order" centered>
              {{ props.row.participant_type && `${props.row.participant_type} (${props.row.participant_order})` }}
            </b-table-column>

            <b-table-column field="paid_fee" label="Confirmed" centered>
              {{ props.row.paid_fee | beautify }}
            </b-table-column>

            <b-table-column field="registered" label="JC registered?" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingRegistered }">
                <select v-model="props.row.newRegistered" @change="switchPaxRegistered(props.row)" :disabled="props.row.departed || !props.row.paid_fee">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column field="departed" label="Departed?" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingDeparted }">
                <select v-model="props.row.newDeparted" @change="switchPaxDeparted(props.row)" :disabled="!props.row.registered">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
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
  name: 'JuridicalView',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      query: '',
      limit: 50,
      displayCancelled: false,
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    filteredApplications () {
      const filterCancelled = this.displayCancelled
        ? this.applications
        : this.applications.filter(app => !app.cancelled && app.status === 'accepted')

      const lowercaseQuery = this.query.toLowerCase()

      return filterCancelled.filter(app =>
        ['first_name', 'last_name', 'email'].some(field => app[field].toLowerCase().includes(lowercaseQuery)))
    }
  },
  methods: {
    switchPaxRegistered (pax) {
      pax.isSavingRegistered = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/registered'

      this.axios.put(url, { registered: pax.newRegistered }).then(() => {
        pax.registered = pax.newRegistered
        pax.isSavingRegistered = false
        this.$root.showSuccess(`Successfully updated registration info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingRegistered = false
        this.$root.showDanger('Could not update participant registration info: ' + err.message)
      })
    },
    switchPaxDeparted (pax) {
      pax.isSavingDeparted = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/departed'

      this.axios.put(url, { departed: pax.newDeparted }).then(() => {
        pax.departed = pax.newDeparted
        pax.isSavingDeparted = false
        this.$root.showSuccess(`Successfully updated departion info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingDeparted = false
        this.$root.showDanger('Could not update participant departion info: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/juridical')
    }).then((application) => {
      this.applications = application.data.data
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
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
