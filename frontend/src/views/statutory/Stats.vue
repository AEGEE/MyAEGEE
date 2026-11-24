<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Application statistics for {{ event.name }}</h1>

        <table class="table is-narrow is-fullwidth" aria-label="Numbers of applications">
          <tbody>
            <tr>
              <th scope="row">Total applications:</th>
              <td>{{ stats.numbers.total }}</td>
            </tr>
            <tr>
              <th scope="row">Cancelled applications:</th>
              <td>{{ stats.numbers.cancelled }}</td>
            </tr>
            <tr>
              <th scope="row">Pending applications:</th>
              <td>{{ stats.numbers.pending }}</td>
            </tr>
            <tr>
              <th scope="row">Waiting list applications:</th>
              <td>{{ stats.numbers.waiting_list }}</td>
            </tr>
            <tr>
              <th scope="row">Rejected applications:</th>
              <td>{{ stats.numbers.rejected }}</td>
            </tr>
            <tr>
              <th scope="row">Accepted applications:</th>
              <td>{{ stats.numbers.accepted }}</td>
            </tr>
            <tr>
              <th scope="row">Confirmed:</th>
              <td>{{ stats.numbers.confirmed }}</td>
            </tr>
            <tr>
              <th scope="row">Arrived:</th>
              <td>{{ stats.numbers.attended }}</td>
            </tr>
          </tbody>
        </table>

        <section v-for="chart in charts" :key="chart.key" :aria-labelledby="'stats-' + chart.key">
          <h2 class="subtitle" :id="'stats-' + chart.key">{{ chart.title }}</h2>
          <p v-if="chart.key === 'quorum'">
            {{ quorum.present }} of {{ quorum.total }} antennae represented by
            {{ stats.quorum.accepted_only ? 'accepted non-cancelled delegate applications' : 'non-cancelled applications' }}.
            Required: {{ quorum.required }} (50%).
          </p>
          <div class="chart">
            <line-chart
              v-if="chart.line"
              :data="chart.data"
              :options="chart.options"
              :aria-label="chart.name"
              :aria-describedby="'stats-' + chart.key + '-data'" />
            <pie-chart
              v-else
              :data="chart.data"
              :options="chart.options"
              :aria-label="chart.name"
              :aria-describedby="'stats-' + chart.key + '-data'" />
          </div>
          <div class="content" v-if="chart.key === 'by-body'">
            <div class="tags">
              <span
                v-for="(body, index) in stats.by_body"
                v-bind:key="index"
                class="tag"
                :style="{ 'background-color': index >= colors.length ? '' : colors[index], color: index >= tagTextColors.length ? '' : tagTextColors[index] }">
                {{ body.body ? body.body.name : body.type }} ({{ body.value }})
              </span>
            </div>
          </div>
          <!-- What the chart shows, for those who can't see it. -->
          <table class="table is-sr-only" :id="'stats-' + chart.key + '-data'">
            <caption>{{ chart.name }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ chart.column }}</th>
                <th scope="col">{{ chart.valueColumn }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in chart.rows" :key="index">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>

<style>
.chart {
  position: relative;
  height: 400px;
}
</style>

<script>
import { mapGetters } from 'vuex'
import {
  Chart,
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { Line, Pie } from 'vue-chartjs'

// The Line and Pie components register their own controllers,
// everything else they draw with has to be registered here.
Chart.register(ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

// chart.js 4 starts the palette over after the last colour; past it, use
// chart.js 2's grey so the slices match the uncoloured tags under the body chart.
const sliceColors = (colors, items) => items.map((item, index) => colors[index] || 'rgba(0, 0, 0, 0.1)')

const lineOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 }
    }
  }
})

const pieOptions = ({ showLegend = true } = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: showLegend
      ? { position: 'bottom', align: 'center', onClick: () => {} }
      : { display: false }
  }
})

const lineData = (chart) => ({
  labels: chart.rows.map(row => row.label),
  datasets: [{
    tension: 0,
    fill: true,
    label: chart.name,
    borderColor: '#1468C5',
    backgroundColor: '#B2D6FF',
    data: chart.rows.map(row => row.value)
  }]
})

const pieData = (chart, colors) => ({
  labels: chart.rows.map(row => row.label),
  datasets: [{
    label: chart.name,
    backgroundColor: chart.colors || sliceColors(colors, chart.rows),
    data: chart.rows.map(row => row.value)
  }]
})

export default {
  name: 'ApplicationStats',
  components: {
    LineChart: Line,
    PieChart: Pie
  },
  data () {
    return {
      event: {
        name: null
      },
      bodies: [],
      stats: {
        quorum: { accepted_only: false, body_ids: [] },
        by_date: [],
        by_date_cumulative: [],
        by_body: [],
        by_type: [],
        by_gender: [],
        by_meal: [],
        by_number_of_events_visited: [],
        numbers: {
          total: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
          waiting_list: 0,
          confirmed: 0,
          attended: 0,
          registered: 0,
          departed: 0,
          cancelled: 0
        }
      },
      // The colour of each slice and of the tag of its body, and the text colour of that tag.
      colors: [
        '#3E95CD', '#8E5EA2', '#3CBA9F', '#E8C3B9', '#C45850',
        '#FFB6B2', '#E5E6BB', '#E6BDE5', '#FFF0B2', '#B2D6FF',
        '#FF5543', '#C2DE5D', '#C44BC2', '#FFDB4C', '#4CA0FF',
        '#C51C13', '#A0C514', '#931991', '#FBBA00', '#1468C5',
        '#7A1E16', '#647A16', '#70086E', '#CF9800', '#163E7A'
      ],
      tagTextColors: [ // using black for all of them except for those when it's unreadable
        '#FFFFFF', '#FFFFFF', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#000000', '#000000', '#000000',
        '#000000', '#000000', '#FFFFFF', '#000000', '#FFFFFF',
        '#FFFFFF', '#FFFFFF', '#FFFFFF', '#000000', '#FFFFFF'
      ],
      mealColorsMap: {
        'Meat-eater': '#C45850',
        'Vegetarian': '#C2DE5D',
        'Vegan': '#A0C514'
      }
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
    }),
    quorum () {
      const localsMap = {}
      for (const body of this.bodies) {
        if (body.type === 'antenna') {
          localsMap[body.id] = true
        }
      }

      const total = Object.keys(localsMap).length
      const present = this.stats.quorum.body_ids
        .filter((bodyId) => bodyId in localsMap)
        .length

      const required = Math.ceil(total / 2)
      return { total, present, required }
    },
    eventTypePluralized () {
      const eventTypePlural = {
        agora: 'Agorae',
        epm: 'EPMs',
        spm: 'SPMs'
      }

      return eventTypePlural[this.event.type]
    },
    // Every chart with the rows it shows: a name for the chart and its table, the header of
    // the table's first column, and the rows as label and value.
    charts () {
      const { total, present } = this.quorum
      const percentage = total > 0 ? present * 100 / total : 0
      const counted = (stats, label = (s) => s.type) => stats.map((s) => ({ label: `${label(s)} (${s.value})`, value: s.value }))

      return [
        {
          key: 'by-date',
          title: 'By date',
          name: 'Applications by date',
          column: 'Date',
          line: true,
          rows: this.stats.by_date.map((s) => ({ label: s.date, value: s.value }))
        },
        {
          key: 'by-date-cumulative',
          title: 'By date (cumulative)',
          name: 'Applications by date (cumulative)',
          column: 'Date',
          line: true,
          rows: this.stats.by_date_cumulative.map((s) => ({ label: s.date, value: s.value }))
        },
        {
          key: 'by-type',
          title: 'By participant type',
          name: 'Applications by participant type',
          column: 'Participant type',
          rows: counted(this.stats.by_type, (s) => (s.type === null ? 'Not set' : s.type))
        },
        {
          key: 'by-body',
          title: 'By body',
          name: 'Applications by body',
          column: 'Body',
          showLegend: false,
          rows: counted(this.stats.by_body, (s) => (s.body ? s.body.name : s.type))
        },
        {
          key: 'by-gender',
          title: 'By gender',
          name: 'Applications by gender',
          column: 'Gender',
          rows: counted(this.stats.by_gender)
        },
        {
          key: 'by-meal',
          title: 'By meal preference',
          name: 'Applications by meal preference',
          column: 'Meal preference',
          colors: this.stats.by_meal.map(s => this.mealColorsMap[s.type] || '#E5E5E5'),
          rows: counted(this.stats.by_meal)
        },
        {
          key: 'by-events-visited',
          title: `By number of ${this.eventTypePluralized} visited`,
          name: `Applications by number of ${this.eventTypePluralized} visited`,
          column: `${this.eventTypePluralized} visited`,
          rows: counted(this.stats.by_number_of_events_visited)
        },
        {
          key: 'quorum',
          title: 'Quorum',
          name: 'Quorum',
          column: 'Antennae',
          valueColumn: 'Antennae',
          colors: ['#C2DE5D', '#C45850'],
          rows: [
            { label: `Represented (${percentage.toFixed(2)}%)`, value: present },
            { label: `Not represented (${(total > 0 ? 100 - percentage : 0).toFixed(2)}%)`, value: total - present }
          ]
        }
      ].map((chart) => ({
        valueColumn: 'Applications',
        ...chart,
        data: chart.line ? lineData(chart) : pieData(chart, this.colors),
        options: chart.line ? lineOptions() : pieOptions(chart)
      }))
    }
  },
  mounted () {
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/stats')
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

      return this.axios.get(this.services['core'] + '/bodies/')
    }).then((bodies) => {
      this.bodies = bodies.data.data
      for (const stat of this.stats.by_body) {
        const body = this.bodies.find(b => stat.type === b.id)
        if (body) {
          this.$set(stat, 'body', body)
        }
      }
    })
      .catch((err) => {
        if (err.response && err.response.status === 404) {
          this.$root.showError('Application is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }
      })
  }
}
</script>
