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
              <th>Cancelled applications:</th>
              <td>{{ stats.numbers.cancelled }}</td>
            </tr>
            <tr>
              <th>Pending applications:</th>
              <td>{{ stats.numbers.pending }}</td>
            </tr>
            <tr>
              <th>Waiting list applications:</th>
              <td>{{ stats.numbers.waiting_list }}</td>
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
              <td>{{ stats.numbers.confirmed }}</td>
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
        <div class="chart"><line-chart :data="byDateData" :options="byDateOptions" /></div>

        <div class="subtitle">By date (cumulative)</div>
        <div class="chart"><line-chart :data="byDateCumulativeData" :options="byDateCumulativeOptions" /></div>

        <div class="subtitle">By participant type</div>
        <div class="chart"><pie-chart :data="byTypeData" :options="byTypeOptions" /></div>

        <div class="subtitle">By body</div>
        <div class="chart"><pie-chart :data="byBodyData" :options="byBodyOptions" /></div>
        <div class="content">
          <div class="tags">
            <span
              v-for="(body, index) in stats.by_body"
              v-bind:key="index"
              class="tag"
              :style="{ 'background-color': index >= colors.length ? '' : colors[index], color: index >= backgroundColors.length ? '' : backgroundColors[index] }">
              {{ body.body ? body.body.name : body.type }} ({{ body.value }})
            </span>
          </div>
        </div>

        <div class="subtitle">By gender</div>
        <div class="chart"><pie-chart :data="byGenderData" :options="byGenderOptions" /></div>

        <div class="subtitle">By meal preference</div>
        <div class="chart"><pie-chart :data="byMealData" :options="byMealOptions" /></div>

        <div class="subtitle">By number of {{ eventTypePluralized }} visited</div>
        <div class="chart"><pie-chart :data="byNumOfEventsData" :options="byNumOfEventsOptions" /></div>

        <div class="subtitle">Quorum</div>
        <p>
          {{ quorum.present }} of {{ quorum.total }} antennae represented by
          {{ stats.quorum.accepted_only ? 'accepted non-cancelled delegate applications' : 'non-cancelled applications' }}.
          Required: {{ quorum.required }} (50%).
        </p>
        <div class="chart"><pie-chart :data="byQuorumData" :options="byQuorumOptions" /></div>
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
      colors: [
        '#3E95CD', '#8E5EA2', '#3CBA9F', '#E8C3B9', '#C45850',
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
      mealColorsMap: {
        'Meat-eater': '#C45850',
        'Vegetarian': '#C2DE5D',
        'Vegan': '#A0C514'
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
          tension: 0,
          fill: true,
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
          tension: 0,
          fill: true,
          label: 'Applications by date',
          borderColor: '#1468C5',
          backgroundColor: '#B2D6FF',
          data: this.stats.by_date_cumulative.map(s => s.value)
        }]
      }
    },
    byDateOptions () {
      return lineOptions()
    },
    byDateCumulativeOptions () {
      return lineOptions()
    },
    byTypeData () {
      return {
        labels: this.stats.by_type.map(s => `${s.type === null ? 'Not set' : s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by participant type',
          backgroundColor: sliceColors(this.colors, this.stats.by_type),
          data: this.stats.by_type.map(s => s.value)
        }]
      }
    },
    byTypeOptions () {
      return pieOptions()
    },
    byBodyOptions () {
      return pieOptions({ showLegend: false })
    },
    byGenderOptions () {
      return pieOptions()
    },
    byMealOptions () {
      return pieOptions()
    },
    byNumOfEventsOptions () {
      return pieOptions()
    },
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
    byQuorumData () {
      const { total, present } = this.quorum
      const percentage = total > 0 ? present * 100 / total : 0
      return {
        labels: [`Represented (${percentage.toFixed(2)}%)`, `Not represented (${(total > 0 ? 100 - percentage : 0).toFixed(2)}%)`],
        datasets: [{
          label: 'Quorum',
          backgroundColor: ['#C2DE5D', '#C45850'],
          data: [present, total - present]
        }]
      }
    },
    byQuorumOptions () {
      return pieOptions()
    },
    eventTypePluralized () {
      const eventTypePlural = {
        agora: 'Agorae',
        epm: 'EPMs',
        spm: 'SPMs'
      }

      return eventTypePlural[this.event.type]
    },
    byBodyData () {
      return {
        labels: this.stats.by_body.map(s => `${s.body ? s.body.name : s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by body',
          backgroundColor: sliceColors(this.colors, this.stats.by_body),
          data: this.stats.by_body.map(s => s.value)
        }]
      }
    },
    byGenderData () {
      return {
        labels: this.stats.by_gender.map(s => `${s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by gender',
          backgroundColor: sliceColors(this.colors, this.stats.by_gender),
          data: this.stats.by_gender.map(s => s.value)
        }]
      }
    },
    byMealData () {
      const mealColors = this.stats.by_meal.map(s => this.mealColorsMap[s.type] || '#E5E5E5')
      return {
        labels: this.stats.by_meal.map(s => `${s.type} (${s.value})`),
        datasets: [{
          label: 'Applications by meal preference',
          backgroundColor: mealColors,
          data: this.stats.by_meal.map(s => s.value)
        }]
      }
    },
    byNumOfEventsData () {
      return {
        labels: this.stats.by_number_of_events_visited.map(s => `${s.type} (${s.value})`),
        datasets: [{
          label: `Applications by number of ${this.eventTypePluralized} visited`,
          backgroundColor: sliceColors(this.colors, this.stats.by_number_of_events_visited),
          data: this.stats.by_number_of_events_visited.map(s => s.value)
        }]
      }
    }
  },
  mounted () {
    this.isLoading = true
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

      this.isLoading = false
    })
      .catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 404) {
          this.$root.showError('Application is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }
      })
  }
}
</script>
