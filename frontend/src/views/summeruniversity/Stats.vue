<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Summer University statistics</div>

        <div class="field is-grouped">
          <div class="control">
            <label class="label">Select season</label>
            <div class="select">
              <select v-model="season" @change="fetchData()">
                <option :value="null">All seasons</option>
                <option v-for="availableSeason in seasons" v-bind:key="availableSeason" :value="availableSeason">
                  {{ availableSeason }}
                </option>
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
          <p class="help" v-if="season === null">Select a season to export the statistics.</p>
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
          <div class="column" v-for="section in sections" v-bind:key="section.key">
            <div class="subtitle">{{ section.title }}</div>
            <table class="table is-narrow is-fullwidth is-striped">
              <thead>
                <tr>
                  <th>{{ section.label }}</th>
                  <th class="has-text-right">{{ section.valueLabel }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in sorted(stats[section.key])" v-bind:key="index">
                  <td>{{ item.type === null ? 'Not set' : item.type }}</td>
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

export default {
  name: 'SummerUniversityStats',
  data () {
    return {
      season: null,
      seasons: [],
      stats: {
        by_event: [],
        by_body: [],
        by_nationality: [],
        by_status: []
      },
      sections: [
        { key: 'by_event', title: 'Applications by event', label: 'Event', valueLabel: 'Applications' },
        { key: 'by_body', title: 'Applicants by body', label: 'Body', valueLabel: 'Applicants' },
        { key: 'by_nationality', title: 'Applicants by nationality', label: 'Nationality', valueLabel: 'Applicants' }
      ],
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
      return items.slice().sort((a, b) => b.value - a.value)
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['summeruniversity'] + '/applications', {
        params: this.season === null ? {} : { season: this.season }
      }).then((response) => {
        this.stats = response.data.data
        this.seasons = response.data.meta.seasons
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch statistics', err)
      })
    },
    exportByBody () {
      if (this.season === null) {
        return
      }

      this.isExporting = true
      this.axios.get(this.services['summeruniversity'] + '/applications/export', {
        params: { season: this.season },
        responseType: 'blob'
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'su_stats_by_body_' + this.season + '.xlsx')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        this.isExporting = false
      }).catch((err) => {
        this.isExporting = false
        this.$root.showError('Could not export statistics', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
