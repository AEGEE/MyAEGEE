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
              <td>
                <div class="select" :class="{ 'is-loading': pax.isSavingPaidFee }">
                  <select v-model="pax.newPaidFee" @change="switchPaxPaidFee(pax)">
                    <option :value="true">Yes</option>
                    <option :value="false">No</option>
                  </select>
                </div>
              </td>
              <td>
                <div class="select" :class="{ 'is-loading': pax.isSavingAttended }">
                  <select v-model="pax.newAttended" @change="switchPaxAttended(pax)">
                    <option :value="true">Yes</option>
                    <option :value="false">No</option>
                  </select>
                </div>
              </td>
              <td>
                <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: pax.id } }">
                  View
                </router-link>
              </td>
            </tr>
            <tr v-if="filteredApplications.length == 0 && !isLoading">
              <td :colspan="selectedFields.length + event.questions.length">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="selectedFields.length + event.questions.length">Loading...</td>
            </tr>
          </tbody>
        </table>
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
      return this.displayCancelled
        ? this.applications
        : this.applications.filter(app => !app.cancelled)
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
        pax.status = pax.newAttended
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
        pax.status = pax.newPaidFee
        pax.isSavingPaidFee = false
        this.$root.showSuccess(`Successfully updated fee info of application for user #${pax.user_id}`)
      }).catch((err) => {
        pax.isSavingPaidFee = false
        this.$root.showDanger('Could not update participant fee info: ' + err.message)
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
        pax.newPaidFee = pax.paid_fee
        pax.newAttended = pax.attended
        pax.isSavingPaidFee = false
        pax.isSavingAttended = false

        this.$forceUpdate()

        this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((user) => {
          const member = user.data.data
          pax.user = member
          pax.body = member.bodies.find(body => body.id === pax.body_id)

          this.$forceUpdate()
        }).catch(console.error)
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
