<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Application statistics for {{ event.name }}</div>

        <div class="subtitle">By date</div>
        <line-chart class="chart" :chart-data="byDateData" :options="byDateOptions"></line-chart>

        <div class="subtitle">By date (cumulative)</div>
        <line-chart class="chart" :chart-data="byDateCumulativeData" :options="byDateOptions"></line-chart>

        <div class="subtitle">By participant type</div>
        <pie-chart class="chart" :chart-data="byTypeData" :options="byTypeOptions"></pie-chart>

        <div class="subtitle">By body</div>
        <pie-chart class="chart" :chart-data="byBodyData" :options="byBodyOptions"></pie-chart>

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
      return {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: false },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              stepValue: 1,
              stepSize: 1
            }
          }]
        }
      }
    },
    byTypeData () {
      return {
        labels: this.stats.by_type.map(s => s.type === null ? 'Not set' : s.type),
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
        }
      }
    },
    byBodyData () {
      return {
        labels: this.stats.by_body.map(s => s.body ? s.body.name : s.body_id),
        datasets: [{
          label: 'Applications by body',
          backgroundColor: ['#3e95cd', '#8e5ea2', '#3cba9f', '#e8c3b9', '#c45850'],
          data: this.stats.by_body.map(s => s.value)
        }]
      }
    },
    byBodyOptions () {
      return {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: true,
          text: 'Applications by body'
        }
      }
    },
    byQuorumData () {
      return {
        labels: ['Present', 'Not present'],
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
        maintainAspectRatio: false
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
      for (const body of this.bodies) {
        const stat = this.stats.by_body.find(b => b.body_id === body.id)
        if (stat) stat.body = body
      }
      this.$forceUpdate()
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Application is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
    })
  }
}
</script>
