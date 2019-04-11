<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Manage applications</div>

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

        <div>Total participants: {{ filteredApplications.length }}</div>

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

            <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered sortable>
              <span :class="calculateClassForMemberslist(props.row)">
                {{ props.row.is_on_memberslist | beautify }}
              </span>
            </b-table-column>

            <!-- important: there should be no whitespaces/line breaks inside this tag, as it messes up the white-space: pre-wrap styling. !-->
            <b-table-column
              v-for="(field, index) in fields"
              :visible="selectedFields.some(sField => sField.name === field.name)"
              v-bind:key="index" field="answers[index]"
              class="has-text-pre-wrap"
              :label="field.name">{{ field.get(props.row) | beautify }}</b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered sortable :visible="displayCancelled">
              {{ props.row.cancelled | beautify }}
            </b-table-column>

            <b-table-column field="paid_fee" label="Confirmed?" centered sortable>
              {{ props.row.paid_fee | beautify }}
            </b-table-column>

            <b-table-column field="attended" label="Attended?" centered sortable>
              {{ props.row.attended | beautify }}
            </b-table-column>

            <b-table-column label="View" centered>
              <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.id } }">
                View
              </router-link>
            </b-table-column>

            <b-table-column label="Manage status" field="status" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSaving }">
                <select v-model="props.row.newStatus" @change="switchPaxStatus(props.row)">
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </b-table-column>
          </template>

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
  name: 'AcceptParticipantsStatutoryList',
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
        { name: 'Nationality', get: (pax) => pax.nationality },
        { name: 'Date of birth', get: (pax) => pax.date_of_birth },
        { name: 'Email', get: (pax) => pax.email },
        { name: 'Meals', get: (pax) => pax.meals },
        { name: 'Allergies', get: (pax) => pax.allergies },
        { name: 'Number of events visited', get: (pax) => pax.number_of_events_visited },
        { name: 'Visa required?', get: (pax) => pax.visa_required },
        { name: 'Visa passport number', get: (pax) => pax.visa_passport_number },
        { name: 'Visa passport issue date', get: (pax) => pax.visa_passport_issue_date },
        { name: 'Visa passport expiration date', get: (pax) => pax.visa_passport_expiration_date },
        { name: 'Visa passport issue authority', get: (pax) => pax.visa_passport_issue_authority },
        { name: 'Place of birth', get: (pax) => pax.visa_place_of_birth },
        { name: 'Embassy', get: (pax) => pax.visa_embassy },
        { name: 'Street and house number', get: (pax) => pax.visa_street_and_house },
        { name: 'Postal code', get: (pax) => pax.visa_postal_code },
        { name: 'City', get: (pax) => pax.visa_city },
        { name: 'Country', get: (pax) => pax.visa_country },
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
    calculateClassForMemberslist (pax) {
      return ['tag', 'is-small', pax.is_on_memberslist ? 'is-primary' : 'is-danger']
    },
    switchPaxStatus (pax) {
      pax.isSaving = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/status'

      this.axios.put(url, { status: pax.newStatus }).then(() => {
        pax.status = pax.newStatus
        pax.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for user #${pax.user_id} to "${pax.status}"`)
      }).catch((err) => {
        pax.isSaving = false
        this.$root.showDanger('Could not update participant status: ' + err.message)
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

      for (const pax of this.applications) {
        this.$set(pax, 'newStatus', pax.status)
        this.$set(pax, 'isSaving', false)
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
