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
              <select v-model="filter.confirmed">
                <option :value="null">Everybody</option>
                <option :value="true">Confirmed participants</option>
                <option :value="false">Not confirmed participants</option>
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
        confirmed: null
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
    exportAll () {
      const prefix = this.can.export.all
        ? 'all'
        : 'incoming'

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
      if (this.filter.confirmed !== null) filter.confirmed = this.filter.confirmed

      return filter
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.can.export.all = false

      const prefix = this.can.export.all
        ? 'all'
        : 'incoming'

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/fields/applications/' + prefix)
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
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
