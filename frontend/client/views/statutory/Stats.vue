<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Application statistics for {{ event.name }}</div>

        <table class="table is-narrow is-fullwidth">
          <tbody>
            <tr>
              <th>Total applications:</th>
              <td>{{ stats.numbers.total }}</td>
            </tr>
            <tr>
              <th>Pending applications:</th>
              <td>{{ stats.numbers.pending }}</td>
            </tr>
            <tr>
              <th>Rejected applications:</th>
              <td>{{ stats.numbers.rejected }}</td>
            </tr>
            <tr>
              <th>Accepted applications:</th>
              <td>{{ stats.numbers.accepted }}</td>
            </tr>
            <tr>
              <th>Confirmed:</th>
              <td>{{ stats.numbers.paid_fee }}</td>
            </tr>
            <tr>
              <th>Arrived:</th>
              <td>{{ stats.numbers.attended }}</td>
            </tr>
            <!--<tr>
              <th>JC registered:</th>
              <td>{{ stats.numbers.registered }}</td>
            </tr>
            <tr>
              <th>Departed:</th>
              <td>{{ stats.numbers.departed }}</td>
            </tr>-->
          </tbody>
        </table>

        <div class="subtitle">By date</div>
        <line-chart class="chart" :chart-data="byDateData" :options="byDateOptions"></line-chart>

        <div class="subtitle">By date (cumulative)</div>
        <line-chart class="chart" :chart-data="byDateCumulativeData" :options="byDateCumulativeOptions"></line-chart>

        <div class="subtitle">By participant type</div>
        <pie-chart class="chart" :chart-data="byTypeData" :options="byTypeOptions"></pie-chart>

        <div class="subtitle">By body</div>
        <pie-chart class="chart" :chart-data="byBodyData()" :options="byBodyOptions"></pie-chart>
        <div class="content">
          <div class="tags">
            <span
              v-for="(body, index) in stats.by_body"
              v-bind:key="index"
              class="tag"
              :style="{ 'background-color': index >= colors.length ? '' : colors[index], 'color': index >= backgroundColors.length ? '' : backgroundColors[index] }">
              {{ body.body ? body.body.name : body.body_id }} ({{ body.value }})
            </span>
          </div>
        </div>

        <div class="subtitle">By gender</div>
        <pie-chart class="chart" :chart-data="byGenderData()" :options="byGenderOptions"></pie-chart>

        <div class="subtitle">By number of events visited</div>
        <pie-chart class="chart" :chart-data="byNumOfEventsData()" :options="byNumOfEventsOptions"></pie-chart>

        <div class="subtitle">Quorum</div>
        <pie-chart class="chart" :chart-data="byQuorumData" :options="byQuorumOptions"></pie-chart>
      </div>
    </div>
  </div>
</template>

<style>
.chart {
  max-height: 500px;
}
</style>

<script>
import { mapGetters } from 'vuex'
import { Pie, Line, mixins } from 'vue-chartjs'
import Vue from 'vue'

const { reactiveProp } = mixins

Vue.component('pie-chart', {
  extends: Pie,
  mixins: [reactiveProp],
  props: ['options'],
  mounted () {
    this.renderChart(this.chartData, this.options)
  }
})

Vue.component('line-chart', {
  extends: Line,
  mixins: [reactiveProp],
  props: ['options'],
  mounted () {
    this.renderChart(this.chartData, this.options)
  }
})

export default {
  name: 'ApplicationStats',
  data () {
    return {
      event: {
        name: null
      },
      bodies: [],
      stats: {
        by_date: [],
        by_date_cumulative: [],
        by_body: [],
        by_type: [],
        by_gender: [],
        by_number_of_events_visited: [],
        numbers: {
          total: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
          paid_fee: 0,
          attended: 0,
          registered: 0,
          departed: 0
        }
      },
      colors: [
        '#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850',
        '#FFB6B2', '#E5E6BB', '#E6BDE5', '#FFF0B2', '#B2D6FF',
        '#FF5543', '#C2DE5D', '#C44BC2', '#FFDB4C', '#4CA0FF',
        '#C51C13', '#A0C514', '#931991', '#FBBA00', '#1468C5',
        '#7A1E16', '#647A16', '#70086E', '#CF9800', '#163E7A'
      ],
      backgroundColors: [ // using black for all of them except for those when it's unreadable
        '#FFFFFF', '#FFFFFF', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#FFFFFF', '#000000', '#FFFFFF',
        '#FFFFFF', '#FFFFFF', '#FFFFFF', '#000000', '#FFFFFF'
      ],
      can: {
        apply: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    byDateData () {
      return {
        labels: this.stats.by_date.map(s => s.date),
        datasets: [{
          lineTension: 0,
          label: 'Applications by date',
          borderColor: '#1468C5',
          backgroundColor: '#B2D6FF',
          data: this.stats.by_date.map(s => s.value)
        }]
      }
    },
    byDateCumulativeData () {
      return {
        labels: this.stats.by_date_cumulative.map(s => s.date),
        datasets: [{
          lineTension: 0,
          label: 'Applications by date',
          borderColor: '#1468C5',
          backgroundColor: '#B2D6FF',
          data: this.stats.by_date_cumulative.map(s => s.value)
        }]
      }
    },
    byDateOptions () {
      const applications = Math.max(...this.stats.by_date.map(s => s.value), 1)
      const tickSize = Math.ceil(applications / 100) * 10

      return {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              stepValue: 1,
              stepSize: tickSize
            }
          }]
        }
      }
    },
    byDateCumulativeOptions () {
      // Custom ticks based on mow much applications there are.
      const applications = this.stats.by_date_cumulative.length > 0
        ? this.stats.by_date_cumulative[this.stats.by_date_cumulative.length - 1].value
        : 1
      const tickSize = Math.ceil(applications / 100) * 10

      return {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              stepValue: 1,
              stepSize: tickSize
            }
          }]
        }
      }
    },
    byTypeData () {
      return {
        labels: this.stats.by_type.map(s => `${s.type === null ? 'Not set' : s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by participant type',
          backgroundColor: this.colors,
          data: this.stats.by_type.map(s => s.value)
        }]
      }
    },
    byTypeOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Applications by participant type'
        },
        legend: {
          position: 'right',
          onClick: (e) => e.stopPropagation()
        }
      }
    },
    byBodyOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Applications by body'
        },
        legend: {
          display: false,
          position: 'right'
        }
      }
    },
    byGenderOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Applications by gender'
        },
        legend: {
          position: 'right'
        }
      }
    },
    byNumOfEventsOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Applications by number of events visited'
        },
        legend: {
          position: 'right'
        }
      }
    },
    byQuorumData () {
      const present = this.stats.by_body.length * 100 / this.bodies.length
      return {
        labels: [`Present (${present.toFixed(2)}%)`, `Not present (${(100 - present).toFixed(2)}%)`],
        datasets: [{
          label: 'Quorum',
          backgroundColor: this.colors,
          data: [this.stats.by_body.length, this.bodies.length - this.stats.by_body.length]
        }]
      }
    },
    byQuorumOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          position: 'right',
          onClick: (e) => e.stopPropagation()
        }
      }
    }
  },
  methods: {
    byBodyData () {
      return {
        labels: this.stats.by_body.map(s => {
          return `${s.body ? s.body.name : s.body_id} (${s.value})`
        }),
        datasets: [{
          label: 'Applications by body',
          backgroundColor: this.colors,
          data: this.stats.by_body.map(s => s.value)
        }]
      }
    },
    byGenderData () {
      return {
        labels: this.stats.by_gender.map(s => `${s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by gender',
          backgroundColor: this.colors,
          data: this.stats.by_gender.map(s => s.value)
        }]
      }
    },
    byNumOfEventsData () {
      return {
        labels: this.stats.by_number_of_events_visited.map(s => `${s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by number of events visited',
          backgroundColor: this.colors,
          data: this.stats.by_number_of_events_visited.map(s => s.value)
        }]
      }
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/stats')
    }).then((stats) => {
      this.stats = stats.data.data

      // Grouping stats, so there'd be only 'male', 'female' and 'other'.
      const femaleGenders = ['f', 'female']
      const maleGenders = ['m', 'male']
      const byGenderStats = [
        { type: 'Male', value: 0 },
        { type: 'Female', value: 0 },
        { type: 'Other', value: 0 }
      ]

      for (const gender of this.stats.by_gender) {
        const stripped = gender.type.toLowerCase().trim()
        if (maleGenders.includes(stripped)) {
          byGenderStats[0].value += gender.value
        } else if (femaleGenders.includes(stripped)) {
          byGenderStats[1].value += gender.value
        } else {
          byGenderStats[2].value += gender.value
        }
      }
      this.stats.by_gender = byGenderStats

      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/')
    }).then((bodies) => {
      this.bodies = bodies.data.data
      for (const stat of this.stats.by_body) {
        const body = this.bodies.find(body => stat.type === body.id)
        if (body) {
          this.$set(stat, 'body', body)
        }
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Application is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
    })
  }
}
</script>
