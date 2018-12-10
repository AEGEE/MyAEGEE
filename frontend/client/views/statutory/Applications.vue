<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Manage applications</div>

        <div class="field">
          <div class="control">
            <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
            <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled applications</button>
          </div>
        </div>

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

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>#</th>
              <th>User ID</th>
              <th>Body</th>
              <th class="has-background-white-bis" v-for="(field, index) in selectedFields" v-bind:key="index">{{ field.name }}</th>
              <th v-if="displayCancelled">Cancelled?</th>
              <th>Paid fee?</th>
              <th>Attended?</th>
              <th>View</th>
              <th>Manage status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in filteredApplications" v-bind:key="pax.user_id" :class="calculateClassForApplication(pax)">
              <td>{{ pax.id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.user_id }}
                </router-link>
              </td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: pax.body_id } }">
                  {{ pax.body ? pax.body.name : 'Loading...' }}
                </router-link>
              </td>
              <td v-for="(field, index) in selectedFields" v-bind:key="index">{{ field.get(pax) }}</td>
              <td v-if="displayCancelled">{{ pax.cancelled ? 'Yes' : 'No' }}</td>
              <td>{{ pax.paid_fee ? 'Yes' : 'No' }}</td>
              <td>{{ pax.attended ? 'Yes' : 'No' }}</td>
              <td>
                <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: pax.id } }">
                  View
                </router-link>
              </td>
              <th>
                <div class="select" :class="{ 'is-loading': pax.isSaving }">
                  <select v-model="pax.newStatus" @change="switchPaxStatus(pax)">
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </th>
            </tr>
            <tr v-if="filteredApplications.length == 0 && !isLoading">
              <td :colspan="selectedFields.length + event.questions.length">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="selectedFields.length + event.questions.length">Loading...</td>
            </tr>
          </tbody>
        </table>

        <nav class="pagination" v-show="applications.length > 0">
          <ul class="pagination-list">
            <li v-for="(value, index) in Math.ceil(applications.length / limit)" :key="index">
              <a class="pagination-link" :class="{ 'is-current': index === page }" @click="page = index">{{ (index + 1) }} </a>
            </li>
          </ul>
        </nav>
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
      page: 0,
      limit: 50,
      selectedFields: [
        { name: 'Participant type', get: (pax) => pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '' },
        { name: 'Board comment', get: (pax) => pax.board_comment }
      ],
      fields: [
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
      const filtered = this.displayCancelled
        ? this.applications
        : this.applications.filter(app => !app.cancelled)

      return filtered.slice(this.page * this.limit, (this.page + 1) * this.limit)
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
    },
    fetchDisplayedUsers () {
      for (const pax of this.filteredApplications) {
        if (pax.user && pax.body) {
          continue
        }

        this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((user) => {
          const member = user.data.data

          this.$set(pax, 'user', member)
          this.$set(pax, 'body', member.bodies.find(body => body.id === pax.body_id))
        }).catch(console.error)
      }
    }
  },
  watch: {
    page () {
      this.fetchDisplayedUsers()
    },
    displayCancelled () {
      this.fetchDisplayedUsers()
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
        pax.newStatus = pax.status
        pax.isSaving = false
      }

      this.fetchDisplayedUsers()
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
