<template>
  <div>
    <div class="content">
      <div class="tags">
        <span class="tag" v-for="(color, key) in colors" :key="key" :style="{ 'background-color': color, 'color': textColors[key] }">
          {{ constants.EVENT_TYPES_NAMES[key] }}
        </span>
      </div>
    </div>

    <hr />

    <FullCalendar
      defaultView="dayGridMonth"
      :plugins="calendarPlugins"
      :events="events"/>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
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
        wu: '#000000',
        rtc: '#1468C5',
        nwm: '#FBBA00',
        ltc: '#931991',
        european: '#C51C13',
        es: '#a0c514'
      },
      textColors: {
        wu: '#ffffff',
        rtc: '#ffffff',
        nwm: '#000000',
        ltc: '#ffffff',
        european: '#ffffff',
        es: '#000000'
      },
      constants,
      isLoading: false,
      calendarPlugins: [ dayGridPlugin ]
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-events']).then((response) => {
      this.events = response.data.data.map((event) => ({
        title: event.name,
        start: new Date(event.starts),
        end: new Date(event.ends),
        backgroundColor: this.colors[event.type] || '#1468C5',
        url: '/events/' + (event.url || event.id)
      }))

      this.isLoading = false
    }).catch((err) => {
      this.events = []
      this.$root.showDanger('Could not fetch events list: ' + err.message)
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    })
  }
}
</script>

