<template>
  <div>
    <div class="content">
      <div class="tags">
        <span class="tag" v-for="(type, key) in constants.EVENT_TYPES_NAMES" :key="key" :style="{ 'background-color': colors[key], 'color': textColors[key] }">
          {{ type }}
        </span>
        <span class="tag" style="background-color: #1468C5; color: #FFFFFF">
          Statutory 
        </span>
      </div>
    </div>

    <hr />

    <FullCalendar
      defaultView="dayGridMonth"
      :firstDay="1"
      :plugins="calendarPlugins"
      :events="events"
      :displayEventTime="false"
      @datesRender="updateStartDate" />

    <b-loading :is-full-page="true" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'
import FullCalendar from '@fullcalendar/vue'
import dayGridPlugin from '@fullcalendar/daygrid'
import constants from '../../constants'

export default {
  name: 'CalendarEventsView',
  components: {
    FullCalendar // make the <FullCalendar> tag available
  },
  data () {
    return {
      events: [],
      colors: {
        training: '#A0C514',
        conference: '#931991',
        nwm: '#FBBA00',
        cultural: '#C51C13',
        
      },
      textColors: {
        training: '#FFFFFF',
        conference: '#FFFFFF',
        nwm: '#FFFFFF',
        cultural: '#FFFFFF',
     
      },
      constants,
      isLoading: false,
      currentMonthStart: null,
      currentMonthEnd: null,
      calendarPlugins: [dayGridPlugin]
    }
  },
  methods: {
    updateStartDate (arg) {
      const currentStart = arg.view.currentStart
      const currentEnd = arg.view.currentEnd
      this.currentMonthStart = moment(currentStart)
      this.currentMonthEnd = moment(currentEnd)
      this.fetchEvents()
    },
    fetchEvents () {
      this.isLoading = true

      const startDate = this.currentMonthStart.subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
      const endDate = this.currentMonthEnd.add(1, 'month').endOf('month').format('YYYY-MM-DD')

      Promise.all([
        this.axios.get(this.services['oms-events'], { params: { starts: startDate, ends: endDate } }),
        this.axios.get(this.services['oms-statutory'], { params: { starts: startDate, ends: endDate } })
      ]).then(([regularResponse, statutoryResponse]) => {
        const regular = regularResponse.data.data.map((event) => ({
          title: event.name,
          start: new Date(event.starts),
          end: new Date(event.ends),
          backgroundColor: this.colors[event.type] || '#1468C5',
          textColor: this.textColors[event.type] || '#FFFFFF',
          url: '/events/' + (event.url || event.id)
        }))

        const statutory = statutoryResponse.data.data.map((event) => ({
          title: event.name,
          start: new Date(event.starts),
          end: new Date(event.ends),
          backgroundColor: '#1468C5',
          textColor: '#FFFFFF',
          url: '/statutory/' + (event.url || event.id)
        }))

        this.events = [...regular, ...statutory]

        this.isLoading = false
      }).catch((err) => {
        this.events = []
        this.$root.showError('Could not fetch events list', err)
      })
    }
  },
  mounted () {
    this.currentMonthStart = moment()
    this.currentMonthEnd = moment()
    this.fetchEvents()
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    })
  }
}
</script>
