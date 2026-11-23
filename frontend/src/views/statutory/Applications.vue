<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Manage applications</h1>

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
              aria-label="Application fields"
              track-by="key"
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
          <label class="label" for="applications-search">Search by name, surname or statutory ID</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input id="applications-search" class="input" type="text" v-model="query" placeholder="Search by name, surname or statutory ID" />
            </div>
            <div class="control">
              <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
              <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled applications</button>
            </div>
          </div>
        </div>

        <div>Total participants: {{ total }}</div>

        <section aria-label="Applications" :aria-busy="isLoading ? 'true' : 'false'">
          <b-table
            :data="applications"
            :loading="isLoading"
            :row-class="row => calculateClassForApplication(row)"
            paginated
            backend-pagination
            :total="total"
            :per-page="limit"
            :current-page.sync="page"
            @page-change="onPageChange"
            backend-sorting
            default-sort="statutory_id"
            default-sort-direction="desc"
            aria-next-label="Next page"
            aria-previous-label="Previous page"
            aria-page-label="Page"
            aria-current-label="Current page"
            @sort="onSort">
            <b-table-column field="statutory_id" label="#" numeric sortable v-slot="props">
              {{ props.row.statutory_id }}
            </b-table-column>

            <b-table-column field="user_id" label="User ID" sortable v-slot="props">
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" centered sortable v-slot="props">
              {{ props.row.body_name }}
            </b-table-column>

            <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered sortable :visible="event.type === 'agora'" v-slot="props">
              <span :class="calculateClassForMemberslist(props.row.is_on_memberslist)">
                {{ props.row.is_on_memberslist | beautify }}
              </span>
            </b-table-column>

            <b-table-column field="is_on_previous_memberslist" label="Was on previous memberslist?" centered sortable :visible="event.type === 'agora'" v-slot="props">
              <span :class="calculateClassForMemberslist(props.row.is_on_previous_memberslist)">
                {{ props.row.is_on_previous_memberslist | beautify }}
              </span>
            </b-table-column>

            <!-- important: there should be no whitespaces/line breaks inside this tag, as it messes up the white-space: pre-wrap styling. !-->
            <b-table-column
              v-for="(field, index) in fields"
              :visible="selectedFields.some(sField => sField.key === field.key)"
              v-bind:key="field.key"
              :field="field.column"
              class="has-text-pre-wrap"
              :sortable="!!field.column"
              :label="field.name"
              v-slot="props">{{ field.get(props.row) | beautify }}</b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered sortable :visible="displayCancelled" v-slot="props">
              {{ props.row.cancelled | beautify }}
            </b-table-column>

            <b-table-column field="confirmed" label="Confirmed?" centered sortable v-slot="props">
              {{ props.row.confirmed | beautify }}
            </b-table-column>

            <b-table-column field="attended" label="Attended?" centered sortable v-slot="props">
              {{ props.row.attended | beautify }}
            </b-table-column>

            <b-table-column label="Manage status" field="status" centered sortable v-slot="props">
              <div class="select" :class="{ 'is-loading': props.row.isSaving }">
                <select v-model="props.row.newStatus" :aria-label="'Status of ' + props.row.first_name + ' ' + props.row.last_name" @change="switchPaxStatus(props.row)">
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="waiting_list">Waiting list</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column label="View" centered v-slot="props">
              <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.statutory_id || props.row.id } }">
                View
              </router-link>
            </b-table-column>

            <b-table-column label="Edit" centered v-slot="props" :visible="!!(event.permissions && event.permissions.manage_applications)">
              <router-link :to="{ name: 'oms.statutory.applications.edit', params: { id: event.url || event.id, application_id: props.row.statutory_id || props.row.id } }">
                Edit
              </router-link>
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'vue-multiselect/dist/vue-multiselect.min.css'
import Multiselect from 'vue-multiselect'

// The fields an application can be shown with. `key` tells them apart (a question may be called
// like a field), `column` is what statutory sorts by.
const BASE_FIELDS = [
  { key: 'first_name', name: 'First name', column: 'first_name', get: (pax) => pax.first_name },
  { key: 'last_name', name: 'Last name', column: 'last_name', get: (pax) => pax.last_name },
  { key: 'gender', name: 'Gender', column: 'gender', get: (pax) => pax.gender },
  { key: 'nationality', name: 'Nationality', column: 'nationality', get: (pax) => pax.nationality },
  { key: 'date_of_birth', name: 'Date of birth', column: 'date_of_birth', get: (pax) => pax.date_of_birth },
  // Core has the address, statutory can't sort by it.
  { key: 'notification_email', name: 'Email', get: (pax) => pax.notification_email },
  { key: 'meals', name: 'Meals', column: 'meals', get: (pax) => pax.meals },
  { key: 'allergies', name: 'Allergies', column: 'allergies', get: (pax) => pax.allergies },
  { key: 'number_of_events_visited', name: 'Number of events visited', column: 'number_of_events_visited', get: (pax) => pax.number_of_events_visited },
  { key: 'visa_required', name: 'Visa required?', column: 'visa_required', get: (pax) => pax.visa_required },
  { key: 'visa_passport_number', name: 'Visa passport number', column: 'visa_passport_number', get: (pax) => pax.visa_passport_number },
  { key: 'visa_passport_issue_date', name: 'Visa passport issue date', column: 'visa_passport_issue_date', get: (pax) => pax.visa_passport_issue_date },
  { key: 'visa_passport_expiration_date', name: 'Visa passport expiration date', column: 'visa_passport_expiration_date', get: (pax) => pax.visa_passport_expiration_date },
  { key: 'visa_passport_issue_authority', name: 'Visa passport issue authority', column: 'visa_passport_issue_authority', get: (pax) => pax.visa_passport_issue_authority },
  { key: 'visa_place_of_birth', name: 'Place of birth', column: 'visa_place_of_birth', get: (pax) => pax.visa_place_of_birth },
  { key: 'visa_embassy', name: 'Embassy', column: 'visa_embassy', get: (pax) => pax.visa_embassy },
  { key: 'visa_street_and_house', name: 'Street and house number', column: 'visa_street_and_house', get: (pax) => pax.visa_street_and_house },
  { key: 'visa_postal_code', name: 'Postal code', column: 'visa_postal_code', get: (pax) => pax.visa_postal_code },
  { key: 'visa_city', name: 'City', column: 'visa_city', get: (pax) => pax.visa_city },
  { key: 'visa_country', name: 'Country', column: 'visa_country', get: (pax) => pax.visa_country },
  { key: 'created_at', name: 'Created at', column: 'created_at', get: (pax) => pax.created_at },
  { key: 'updated_at', name: 'Updated at', column: 'updated_at', get: (pax) => pax.updated_at },
  { key: 'participant_type', name: 'Participant type', column: 'participant_type', get: (pax) => (pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '') },
  { key: 'board_comment', name: 'Board comment', column: 'board_comment', get: (pax) => pax.board_comment }
]

const DEFAULT_FIELDS = ['participant_type', 'board_comment', 'first_name', 'last_name']

export default {
  name: 'AcceptParticipantsStatutoryList',
  components: {
    Multiselect
  },
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      query: '',
      limit: 50,
      offset: 0,
      page: 1,
      total: 0,
      sort: {
        field: 'id',
        order: 'desc'
      },
      selectedFields: BASE_FIELDS.filter((field) => DEFAULT_FIELDS.includes(field.key)),
      baseFields: BASE_FIELDS,
      displayCancelled: false,
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    // The event's questions are appended to the static field list. This has to be
    // derived rather than pushed, as the applications are reloaded on every search,
    // sort and page change, which would otherwise duplicate the question fields.
    fields () {
      const questions = this.event.questions || []
      return this.baseFields.concat(questions.map((question, index) => ({
        key: `question:${index}`,
        name: question.description,
        get: (pax) => pax.answers[index]
      })))
    },
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
    // Another search or filter starts from the first page.
    query () {
      this.offset = 0
      this.page = 1
      this.loadApplications()
    },
    displayCancelled () {
      this.offset = 0
      this.page = 1
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
        // Showing the status that is still stored.
        pax.newStatus = pax.status
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

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/all', { params: this.queryObject }).then((application) => {
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        for (const pax of this.applications) {
          this.$set(pax, 'newStatus', pax.status)
          this.$set(pax, 'isSaving', false)
        }
      }).catch(this.showLoadError)
    },
    showLoadError (err) {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    }
  },
  mounted () {
    this.isLoading = true

    // The event is the same for every search and page, so it's loaded once.
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.loadApplications()
    }).catch(this.showLoadError)
  }
}
</script>
