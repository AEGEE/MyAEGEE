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
              label="name">
              <template
                slot="selection"
                slot-scope="{ values, isOpen }">
                <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">{{ values.length }} fields selected</span>
              </template>
            </multiselect>
          </div>
        </div>

        <div class="field">
          <label class="label">Search by name or surname</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name or surname" />
            </div>
            <div class="control">
              <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
              <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled applications</button>
            </div>
          </div>
        </div>

        <div>Total participants: {{ total }}</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          :row-class="row => calculateClassForApplication(row)"
          paginated
          backend-pagination
          :total="total"
          :per-page="limit"
          @page-change="onPageChange"
          backend-sorting
          default-sort="statutory_id"
          default-sort-direction="desc"
          @sort="onSort">
          <template slot-scope="props">
            <b-table-column field="statutory_id" label="#" numeric sortable>
              {{ props.row.statutory_id }}
            </b-table-column>

            <b-table-column field="user_id" label="User ID" sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" centered sortable>
              {{ props.row.body_name }}
            </b-table-column>

            <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered sortable :visible="event.type === 'agora'">
              <span :class="calculateClassForMemberslist(props.row.is_on_memberslist)">
                {{ props.row.is_on_memberslist | beautify }}
              </span>
            </b-table-column>

            <b-table-column field="was_on_memberslist" label="Was on previous memberslist?" centered sortable :visible="event.type === 'agora'">
              <span :class="calculateClassForMemberslist(props.row.is_on_previous_memberslist)">
                {{ props.row.is_on_previous_memberslist | beautify }}
              </span>
            </b-table-column>

            <!-- important: there should be no whitespaces/line breaks inside this tag, as it messes up the white-space: pre-wrap styling. !-->
            <b-table-column
              v-for="(field, index) in fields"
              :visible="selectedFields.some(sField => sField.name === field.name)"
              v-bind:key="index"
              :field="field.column"
              class="has-text-pre-wrap"
              sortable
              :label="field.name">{{ field.get(props.row) | beautify }}</b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered sortable :visible="displayCancelled">
              {{ props.row.cancelled | beautify }}
            </b-table-column>

            <b-table-column field="confirmed" label="Confirmed?" centered sortable>
              {{ props.row.confirmed | beautify }}
            </b-table-column>

            <b-table-column field="attended" label="Attended?" centered sortable>
              {{ props.row.attended | beautify }}
            </b-table-column>

            <b-table-column label="View" centered>
              <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.statutory_id || props.row.id } }">
                View
              </router-link>
            </b-table-column>

            <b-table-column label="Manage status" field="status" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSaving }">
                <select v-model="props.row.newStatus" @change="switchPaxStatus(props.row)">
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="waiting_list">Waiting list</option>
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
      offset: 0,
      total: 0,
      sort: {
        field: 'id',
        direction: 'desc'
      },
      selectedFields: [
        { name: 'Participant type', get: (pax) => (pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '') },
        { name: 'Board comment', get: (pax) => pax.board_comment },
        { name: 'First name', get: (pax) => pax.first_name },
        { name: 'Last name', get: (pax) => pax.last_name }
      ],
      fields: [
        { name: 'First name', column: 'first_name', get: (pax) => pax.first_name },
        { name: 'Last name', column: 'last_name', get: (pax) => pax.last_name },
        { name: 'Gender', column: 'gender', get: (pax) => pax.gender },
        { name: 'Nationality', column: 'nationality', get: (pax) => pax.nationality },
        { name: 'Date of birth', column: 'date_of_birth', get: (pax) => pax.date_of_birth },
        { name: 'Email', column: 'notification_email', get: (pax) => pax.notification_email },
        { name: 'Meals', column: 'meals', get: (pax) => pax.meals },
        { name: 'Allergies', column: 'allergies', get: (pax) => pax.allergies },
        { name: 'Number of events visited', column: 'number_of_events_visited', get: (pax) => pax.number_of_events_visited },
        { name: 'Visa required?', column: 'visa_required', get: (pax) => pax.visa_required },
        { name: 'Visa passport number', column: 'visa_passport_number', get: (pax) => pax.visa_passport_number },
        { name: 'Visa passport issue date', column: 'visa_passport_issue_date', get: (pax) => pax.visa_passport_issue_date },
        { name: 'Visa passport expiration date', column: 'visa_passport_expiration_date', get: (pax) => pax.visa_passport_expiration_date },
        { name: 'Visa passport issue authority', column: 'visa_passport_issue_authority', get: (pax) => pax.visa_passport_issue_authority },
        { name: 'Place of birth', column: 'visa_place_of_birth', get: (pax) => pax.visa_place_of_birth },
        { name: 'Embassy', column: 'visa_embassy', get: (pax) => pax.visa_embassy },
        { name: 'Street and house number', column: 'visa_street_and_house', get: (pax) => pax.visa_street_and_house },
        { name: 'Postal code', column: 'visa_postal_code', get: (pax) => pax.visa_postal_code },
        { name: 'City', column: 'visa_city', get: (pax) => pax.visa_city },
        { name: 'Country', column: 'visa_country', get: (pax) => pax.visa_country },
        { name: 'Created at', column: 'created_at', get: (pax) => pax.created_at },
        { name: 'Updated at', column: 'updated_at', get: (pax) => pax.updated_at },
        { name: 'Participant type', column: 'participant_type', get: (pax) => (pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '') },
        { name: 'Board comment', column: 'board_comment', get: (pax) => pax.board_comment }
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
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset,
        sort: this.sort
      }

      if (this.query) queryObj.query = this.query
      if (this.displayCancelled) queryObj.displayCancelled = true
      return queryObj
    }
  },
  watch: {
    query () {
      this.loadApplications()
    },
    displayCancelled () {
      this.loadApplications()
    }
  },
  methods: {
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
    calculateClassForMemberslist (isOnMemberslist) {
      return ['tag', 'is-small', isOnMemberslist ? 'is-primary' : 'is-danger']
    },
    switchPaxStatus (pax) {
      pax.isSaving = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/status'

      this.axios.put(url, { status: pax.newStatus }).then(() => {
        pax.status = pax.newStatus
        pax.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for user #${pax.user_id} to "${pax.status}"`)
      }).catch((err) => {
        pax.isSaving = false
        this.$root.showError('Could not update participant status', err)
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

        for (const index in this.event.questions) {
          this.fields.push({
            name: this.event.questions[index].description,
            get: pax => pax.answers[index]
          })
        }

        return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/all', { params: this.queryObject })
      }).then((application) => {
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        for (const pax of this.applications) {
          this.$set(pax, 'newStatus', pax.status)
          this.$set(pax, 'isSaving', false)
        }
      }).catch((err) => {
        this.isLoading = false
        if (err.response.status === 404) {
          this.$root.showError('Event is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }
      })
    }
  },
  mounted () {
    this.loadApplications()
  }
}
</script>
