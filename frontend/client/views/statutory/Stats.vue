<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Application statistics for {{ event.name }}</div>

        <div class="subtitle">By date</div>
        <line-chart class="chart" :chart-data="byDateData" :options="byDateOptions"></line-chart>

        <div class="subtitle">By date (cumulative)</div>
        <line-chart class="chart" :chart-data="byDateCumulativeData" :options="byDateCumulativeOptions"></line-chart>

        <div class="subtitle">By participant type</div>
        <pie-chart class="chart" :chart-data="byTypeData" :options="byTypeOptions"></pie-chart>

        <div class="subtitle">By body</div>
        <pie-chart class="chart" :chart-data="byBodyData()" :options="byBodyOptions"></pie-chart>

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
  name: 'EditApplication',
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
        by_type: []
      },
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
          backgroundColor: ['#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850'],
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
          backgroundColor: ['#3e95cd', '#8e5ea2'],
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
          backgroundColor: ['#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850'],
          data: this.stats.by_body.map(s => s.value)
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
      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/')
    }).then((bodies) => {
      this.bodies = bodies.data.data
      for (const stat of this.stats.by_body) {
        const body = this.bodies.find(body => stat.body_id === body.id)
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
