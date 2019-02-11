<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Export data</div>
        <div v-if="can.export.openslides">
          <div class="field">
            <div class="control">
              <button @click="exportOpenSlides()" class="button is-primary">
                Export OpenSlides data
              </button>
            </div>
          </div>

          <div class="notification is-info">
              Keep in mind that the passwords for OpenSlides are generated at the runtime.
              If you'll export this data 2 times, you'll get 2 different set of passwords.
              Therefore it's more reasonable to do it only when you'll have the participants list finalized.
          </div>

          <hr />
        </div>

        <div>
          <div class="field is-fullwidth">
            <label class="label">Filter on participant status</label>
            <div class="select">
              <select v-model="filter.status">
                <option :value="null">Everybody</option>
                <option value="accepted">Accepted participants</option>
                <option value="rejected">Rejected participants</option>
                <option value="pending">Pending participants</option>
              </select>
            </div>
          </div>

          <div class="field is-fullwidth">
            <label class="label">Filter on confirmation</label>
            <div class="select">
              <select v-model="filter.paid_fee">
                <option :value="null">Everybody</option>
                <option :value="true">Confirmed participants</option>
                <option :value="false">Not confirmed participants</option>
              </select>
            </div>
          </div>

          <div v-if="!can.export.all">
            <div class="field" v-for="(field, key) in incomingFields" v-bind:key="key">
              <label class="checkbox">
                <input type="checkbox" v-model="selectedFields[key]">
                {{ incomingFields[key] }}
              </label>
            </div>

            <div class="field">
              <div class="control">
                <button @click="exportAll('incoming')" class="button is-primary">
                  Export incoming info
                </button>
              </div>
            </div>
          </div>

          <div v-if="can.export.all">
            <div class="field" v-for="(field, key) in fields" v-bind:key="key">
              <label class="checkbox">
                <input type="checkbox" v-model="selectedFields[key]">
                {{ fields[key] }}
              </label>
            </div>


            <div class="field">
              <div class="control">
                <button @click="exportAll('all')" class="button is-primary">
                  Export participants data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ExportStatutoryData',
  data () {
    return {
      applications: [],
      fields: {
        id: 'ID',
        user_id: 'User ID',
        body_id: 'Body ID',
        created_at: 'Applied on',
        updated_at: 'Updated at',
        visa_required: 'Visa required?',
        participant_type: 'Participant type',
        participant_order: 'Participant order',
        board_comment: 'Board comment',
        status: 'Status',
        cancelled: 'Cancelled?',
        paid_fee: 'Confirmed?',
        attended: 'Attended?',
        registered: 'JC registered?',
        departed: 'Departed?',
        first_name: 'First name',
        last_name: 'Last name',
        email: 'Email',
        gender: 'Gender',
        body_name: 'Body name',
        nationality: 'Nationality',
        visa_place_of_birth: 'Visa: place of birth',
        visa_passport_number: 'Visa: passport number',
        visa_passport_issue_date: 'Visa: passport issue date',
        visa_passport_expiration_date: 'Visa: passport expiration date',
        visa_passport_issue_authority: 'Visa: passport issue authority',
        visa_embassy: 'Visa: embassy',
        visa_street_and_house: 'Visa: street and house number',
        visa_postal_code: 'Visa: postal code',
        visa_city: 'Visa: city',
        visa_country: 'Visa: country',
        date_of_birth: 'Date of birth',
        number_of_events_visited: 'Number of Agora/EPM visited',
        meals: 'Meals',
        allergies: 'Allergies'
      },
      incomingFields: {
        id: 'ID',
        user_id: 'User ID',
        body_id: 'Body ID',
        created_at: 'Applied on',
        updated_at: 'Updated at',
        visa_required: 'Visa required?',
        participant_type: 'Participant type',
        participant_order: 'Participant order',
        board_comment: 'Board comment',
        status: 'Status',
        cancelled: 'Cancelled?',
        paid_fee: 'Confirmed?',
        attended: 'Attended?',
        registered: 'JC registered?',
        departed: 'Departed?',
        first_name: 'First name',
        last_name: 'Last name',
        email: 'Email',
        gender: 'Gender',
        body_name: 'Body name',
        nationality: 'Nationality',
        visa_place_of_birth: 'Visa: place of birth',
        visa_passport_number: 'Visa: passport number',
        visa_passport_issue_date: 'Visa: passport issue date',
        visa_passport_expiration_date: 'Visa: passport expiration date',
        visa_passport_issue_authority: 'Visa: passport issue authority',
        visa_embassy: 'Visa: embassy',
        visa_street_and_house: 'Visa: street and house number',
        visa_postal_code: 'Visa: postal code',
        visa_city: 'Visa: city',
        visa_country: 'Visa: country',
        date_of_birth: 'Date of birth',
        number_of_events_visited: 'Number of Agora/EPM visited',
        meals: 'Meals',
        allergies: 'Allergies'
      },
      selectedFields: {},
      event: {
        name: ''
      },
      filter: {
        status: null,
        paid_fee: null
      },
      can: {
        export: {
          all: false,
          openslides: false,
          incoming: false
        }
      }
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  methods: {
    exportOpenSlides () {
      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/export/openslides', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'openslides.csv')
        document.body.appendChild(link)
        link.click()
      })
    },
    exportAll (prefix) {
      const select = this.filterKeys()
      const filter = this.filterApplications()

      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/export/' + prefix, {
        responseType: 'blob',
        params: {
          select,
          filter
        }
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'participants.xlsx')
        document.body.appendChild(link)
        link.click()
      })
    },
    filterKeys () {
      return Object.keys(this.selectedFields).filter(key => this.selectedFields[key])
    },
    filterApplications () {
      const filter = {}

      if (this.filter.status !== null) filter.status = this.filter.status
      if (this.filter.paid_fee !== null) filter.paid_fee = this.filter.paid_fee

      return filter
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      this.isLoading = false

      // To not copypaste stuff.
      // Selecting all answers by default.
      for (const field in this.fields) {
        const isIncomingField = (field in this.incomingFields)
        this.$set(this.selectedFields, field, this.can.export.all || isIncomingField)
      }

      for (let index = 0; index < this.event.questions.length; index++) {
        this.$set(this.fields, 'answers.' + index, `Answer ${index + 1}: ${this.event.questions[index].description}`)
        this.$set(this.selectedFields, 'answers.' + index, this.can.export.all) // answers are only available to export.all
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
