<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div>
          <div class="field is-fullwidth">
            <label class="label">Filter on candidate status</label>
            <div class="select">
              <select v-model="filter.status">
                <option :value="null">Everybody</option>
                <option value="accepted">Accepted candidates</option>
                <option value="rejected">Rejected candidates</option>
                <option value="pending">Pending candidates</option>
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
                  Export candidates data
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
        status: null
      },
      can: {
        manage_candidates: false
      }
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  methods: {
    exportAll () {
      const select = this.filterKeys()
      const filter = this.filterApplications()

      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/export', {
        responseType: 'blob',
        params: {
          select,
          filter
        }
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'candidates.xlsx')
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

      return filter
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/fields/candidates')
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
