<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Export data for {{ event.name }}</div>
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
          <div class="field is-fullwidth" v-if="this.can.export.all">
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

          <div class="field is-fullwidth" v-if="this.can.export.all">
            <label class="label">Filter on cancellation</label>
            <div class="select">
              <select v-model="filter.cancelled">
                <option :value="null">Everybody</option>
                <option :value="true">Cancelled participants</option>
                <option :value="false">Not cancelled participants</option>
              </select>
            </div>
          </div>

          <div class="field is-fullwidth" v-if="this.can.export.all">
            <label class="label">Filter on confirmation</label>
            <div class="select">
              <select v-model="filter.confirmed">
                <option :value="null">Everybody</option>
                <option :value="true">Confirmed participants</option>
                <option :value="false">Not confirmed participants</option>
              </select>
            </div>
          </div>

          <div class="field is-fullwidth" v-if="this.can.export.all">
            <label class="label">Filter on participant type</label>
            <div class="select">
              <select v-model="filter.participant_type">
                <option :value="null">Everybody</option>
                <option value="delegate">Delegates</option>
                <option value="envoy">Envoys</option>
                <option value="observer">Observers</option>
                <option value="visitor">Visitors</option>
              </select>
            </div>
          </div>

          <div>
            <div class="field" v-for="(field, key) in fields" v-bind:key="key">
              <label class="checkbox">
                <input type="checkbox" v-model="selectedFields[key]">
                {{ fields[key] }}
              </label>
            </div>

            <div class="field">
              <div class="control">
                <button @click="exportAll()" class="button is-primary">
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
      fields: {},
      selectedFields: {},
      event: {
        name: ''
      },
      filter: {
        status: null,
        cancelled: null,
        confirmed: null,
        participant_type: null
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
      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/export/openslides', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'openslides_' + new Date().toISOString() + '.csv'
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
      })
    },
    exportAll () {
      const prefix = this.can.export.all
        ? 'all'
        : 'incoming'

      const select = this.filterKeys()
      const filter = this.filterApplications()

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/export/' + prefix, {
        responseType: 'blob',
        params: {
          select,
          filter
        }
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'participants_' + new Date().toISOString() + '.xlsx'
        link.setAttribute('download', filename)
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
      if (this.filter.cancelled !== null) filter.cancelled = this.filter.cancelled
      if (this.filter.confirmed !== null) filter.confirmed = this.filter.confirmed
      if (this.filter.participant_type !== null) filter.participant_type = this.filter.participant_type

      return filter
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      const prefix = this.can.export.all
        ? 'all'
        : 'incoming'

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/fields/applications/' + prefix)
    }).then((response) => {
      this.fields = response.data.data
      this.isLoading = false

      // To not copypaste stuff.
      // Selecting all answers by default.
      for (const field in this.fields) {
        this.$set(this.selectedFields, field, true)
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
}
</script>
