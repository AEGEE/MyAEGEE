<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Summer University statistics</h1>

        <div class="field is-grouped is-grouped-multiline">
          <div class="control">
            <label class="label" for="stats-season">Season</label>
            <div class="select">
              <select id="stats-season" v-model="season" @change="fetchData()">
                <option :value="null">All seasons</option>
                <option v-for="item in seasons" :key="item.year" :value="item.year">{{ item.year }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <button
              class="button is-primary"
              :class="{ 'is-loading': isExporting }"
              :disabled="season === null || isExporting"
              @click="exportByBody()">
              Export applicants by body
            </button>
          </div>
          <p class="help" v-if="season === null">Select a season to export the applicants by body.</p>
        </div>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <table class="table is-narrow is-fullwidth">
          <tbody>
            <tr>
              <th>Total applications:</th>
              <td>{{ getStatusValue('total_applications') }}</td>
            </tr>
            <tr>
              <th>Unique applicants:</th>
              <td>{{ getStatusValue('total_members') }}</td>
            </tr>
            <tr>
              <th>Confirmed applications:</th>
              <td>{{ getStatusValue('confirmed') }}</td>
            </tr>
          </tbody>
        </table>

        <div class="columns">
          <div class="column" v-for="section in sections" :key="section.key">
            <h2 class="subtitle" :id="'stats-' + section.key">{{ section.title }}</h2>
            <table class="table is-narrow is-fullwidth is-striped" :aria-labelledby="'stats-' + section.key">
              <thead>
                <tr>
                  <th>{{ section.label }}</th>
                  <th class="has-text-right">{{ section.valueLabel }}</th>
                </tr>
              </thead>
              <tbody>
                <!-- Keyed by position, as two events can have the same name. -->
                <tr v-for="(item, index) in sorted(stats[section.key])" :key="index">
                  <td>{{ item.type }}</td>
                  <td class="has-text-right">{{ item.value }}</td>
                </tr>
                <tr v-if="!isLoading && stats[section.key].length === 0">
                  <td colspan="2" class="has-text-centered">No data.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

const emptyStats = () => ({
  by_event: [],
  by_body: [],
  by_nationality: [],
  by_status: []
})

export default {
  name: 'SummerUniversityStats',
  data () {
    return {
      season: null,
      seasons: [],
      stats: emptyStats(),
      sections: [
        { key: 'by_event', title: 'Applications by event', label: 'Event', valueLabel: 'Applications' },
        { key: 'by_body', title: 'Applicants by body', label: 'Body', valueLabel: 'Applicants' },
        { key: 'by_nationality', title: 'Applicants by nationality', label: 'Nationality', valueLabel: 'Applicants' }
      ],
      // Counts the stats requests, so a slow response for a previous season doesn't overwrite the current one.
      requestId: 0,
      isLoading: false,
      isExporting: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    getStatusValue (type) {
      const status = this.stats.by_status.find(s => s.type === type)
      return status ? status.value : 0
    },
    sorted (items) {
      return items.slice().sort((a, b) => b.value - a.value || String(a.type).localeCompare(String(b.type)))
    },
    fetchData () {
      this.isLoading = true
      const requestId = ++this.requestId

      this.axios.get(this.services['summeruniversity'] + '/applications', {
        params: this.season === null ? {} : { season: this.season }
      }).then((response) => {
        if (requestId !== this.requestId) return

        this.stats = response.data.data
        this.isLoading = false
      }).catch((err) => {
        if (requestId !== this.requestId) return

        // Not leaving the previous season's numbers under the newly selected season.
        this.stats = emptyStats()
        this.isLoading = false
        this.$root.showError('Could not fetch statistics', err)
      })
    },
    exportByBody () {
      if (this.season === null) {
        return
      }

      const season = this.season
      this.isExporting = true
      this.axios.get(this.services['summeruniversity'] + '/applications/export', {
        params: { season },
        responseType: 'blob'
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'su_stats_by_body_' + season + '.xlsx')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // Revoking it after the click is handled, so the download can start.
        setTimeout(() => window.URL.revokeObjectURL(url), 0)
        this.isExporting = false
      }).catch(async (err) => {
        // The error body is a Blob too, so reading the API's message out of it.
        if (err.response && err.response.data instanceof Blob) {
          try {
            err.response.data = JSON.parse(await err.response.data.text())
          } catch (parseError) {
            err.response.data = null
          }
        }

        this.isExporting = false
        this.$root.showError('Could not export statistics', err)
      })
    }
  },
  mounted () {
    // Showing the active season by default, like the Summer University list.
    this.isLoading = true
    this.axios.get(this.services['summeruniversity'] + '/seasons').then((response) => {
      this.seasons = response.data.data
      const active = this.seasons.find((item) => item.active)
      this.season = active ? active.year : null
    }).catch((err) => {
      this.$root.showError('Could not fetch seasons', err)
    }).finally(() => {
      this.fetchData()
    })
  }
}
</script>
