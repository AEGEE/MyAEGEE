<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Incoming</div>

        <div class="field">
          <div class="control">
            <multiselect
              v-model="selectedFields"
              :multiple="true"
              :searchable="false"
              :close-on-select="false"
              :clear-on-select="false"
              :preserve-search="true"
              :options="fields"
              placeholder="Select application fields"
              track-by="name"
              label="name" >
              <template
                slot="selection"
                slot-scope="{ values, search, isOpen }">
                <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">{{ values.length }} fields selected</span>
              </template>
            </multiselect>
          </div>
        </div>

        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name, surname or email" />
            </div>
            <div class="control">
              <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
              <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled applications</button>
            </div>
          </div>
        </div>

        <b-table
          :data="filteredApplications"
          :loading="isLoading"
          :row-class="row => calculateClassForApplication(row)"
          paginated
          :per-page="limit"
          default-sort="id"
          default-sort-direction="desc">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="name" label="User ID" sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" centered sortable>
              {{ props.row.body_name }}
            </b-table-column>

            <b-table-column v-for="(field, index) in selectedFields" v-bind:key="index" field="answers[index]" :label="field.name" sortable>
              {{ field.get(props.row) | beautify }}
            </b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered sortable :visible="displayCancelled">
              {{ props.row.cancelled | beautify }}
            </b-table-column>

            <b-table-column field="paid_fee" label="Confirmed?" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingPaidFee }">
                <select v-model="props.row.newPaidFee" @change="switchPaxPaidFee(props.row)" :disabled="props.row.attended">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column field="attended" label="Attended?" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingAttended }">
                <select v-model="props.row.newAttended" @change="switchPaxAttended(props.row)" :disabled="!props.row.paid_fee || props.row.departed">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column field="paid_fee" label="Departed?" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingDeparted }">
                <select v-model="props.row.newDeparted" @change="switchPaxDeparted(props.row)" :disabled="!props.row.attended">
                  <option :value="true">Yes</option>
                  <option :value="false">No</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column label="View" centered>
              <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.id } }">
                View
              </router-link>
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
  name: 'StatutoryIncoming',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      query: '',
      limit: 50,
      selectedFields: [
        { name: 'Participant type', get: (pax) => pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '' },
        { name: 'Board comment', get: (pax) => pax.board_comment },
        { name: 'First name', get: (pax) => pax.first_name },
        { name: 'Last name', get: (pax) => pax.last_name }
      ],
      fields: [
        { name: 'First name', get: (pax) => pax.first_name },
        { name: 'Last name', get: (pax) => pax.last_name },
        { name: 'Gender', get: (pax) => pax.gender },
        { name: 'Email', get: (pax) => pax.email },
        { name: 'Created at', get: (pax) => pax.created_at },
        { name: 'Updated at', get: (pax) => pax.updated_at },
        { name: 'Participant type', get: (pax) => pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '' },
        { name: 'Board comment', get: (pax) => pax.board_comment }
      ],
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
        : this.applications.filter(app => !app.cancelled)

      const lowercaseQuery = this.query.toLowerCase()

      return filterCancelled.filter(app =>
        ['first_name', 'last_name', 'email'].some(field => app[field].toLowerCase().includes(lowercaseQuery)))
    }
  },
  methods: {
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
    switchPaxAttended (pax) {
      pax.isSavingAttended = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/attended'

      this.axios.put(url, { attended: pax.newAttended }).then(() => {
        pax.attended = pax.newAttended
        pax.isSavingAttended = false
        this.$root.showSuccess(`Successfully updated attendance info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingAttended = false
        this.$root.showDanger('Could not update participant attendance info: ' + err.message)
      })
    },
    switchPaxPaidFee (pax) {
      pax.isSavingPaidFee = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/paid_fee'

      this.axios.put(url, { paid_fee: pax.newPaidFee }).then(() => {
        pax.paid_fee = pax.newPaidFee
        pax.isSavingPaidFee = false
        this.$root.showSuccess(`Successfully updated fee info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingPaidFee = false
        this.$root.showDanger('Could not update participant fee info: ' + err.message)
      })
    },
    switchPaxDeparted (pax) {
      pax.isSavingDeparted = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/departed'

      this.axios.put(url, { departed: pax.newDeparted }).then(() => {
        pax.departed = pax.newDeparted
        pax.isSavingDeparted = false
        this.$root.showSuccess(`Successfully marked user #${pax.user_id} as departed`)
      }).catch((err) => {
        pax.isSavingDeparted = false
        this.$root.showDanger('Could not mark user as departed: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data

      for (const index in this.event.questions) {
        this.fields.push({
          name: this.event.questions[index].description,
          get: pax => pax.answers[index]
        })
      }

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/all')
    }).then((application) => {
      this.applications = application.data.data
      this.isLoading = false

      // Fetching users and bodies.
      for (const pax of this.applications) {
        this.$set(pax, 'newPaidFee', pax.paid_fee)
        this.$set(pax, 'newAttended', pax.attended)
        this.$set(pax, 'newDeparted', pax.departed)
        this.$set(pax, 'isSavingPaidFee', false)
        this.$set(pax, 'isSavingAttended', false)
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
