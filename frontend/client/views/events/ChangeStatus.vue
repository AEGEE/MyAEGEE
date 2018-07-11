<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Change events' statuses</h4>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Event type</th>
                <th>Event name</th>
                <th>Description</th>
                <th>Dates</th>
                <th>Current status</th>
                <th>Status to change</th>
                <th></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Event type</th>
                <th>Event name</th>
                <th>Description</th>
                <th>Dates</th>
                <th>Current status</th>
                <th>Status to change</th>
                <th></th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="events.length" v-for="event in events" v-bind:key="event.id">
                <td>{{ event.type }}</td>
                <td>
                  <router-link :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }">
                    {{ event.name }}
                  </router-link>
                </td>
                <td>{{ event.description }}</td>
                <td>{{ event.starts | date }} - {{ event.ends | date }}</td>
                <td>{{ event.status.name }}</td>
                <td>
                  <div class="select">
                    <select v-model="event.futureStatus">
                      <option
                        v-for="newStatus in event.futureStatuses"
                        v-bind:key="newStatus.name"
                        v-bind:value="newStatus">
                        {{ newStatus.name }}
                      </option>
                    </select>
                  </div>
                </td>
                <td>
                  <a class="button is-primary" :disabled="!event.futureStatus" @click="changeStatus(event)">Change status</a>
                </td>
              </tr>
              <tr v-show="!events.length && !isLoading">
                <td colspan="5" class="has-text-centered">There are no events for which you can change status.</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="5" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'

export default {
  name: 'ChangeEventsStatus',
  data () {
    return {
      events: [],
      isLoading: false,
      permissions: []
    }
  },
  computed: mapGetters(['services']),
  methods: {
    calculateFutureStatuses (event) {
      event.futureStatuses = event.lifecycle.statuses.filter((status) => {
        return event.lifecycle.transitions.some((transition) => {
          return transition.from && transition.from === event.status.name && transition.to === status.name
        })
      })
    },
    changeStatus (event) {
      this.axios.put(this.services['oms-events'] + '/single/' + event.id + '/status', {
        status: event.futureStatus.name
      }).then(() => {
        this.$toast.open({
          message: 'Event status is now "' + event.futureStatus.name + '".',
          type: 'is-success'
        })

        this.events = []
        this.fetchData()
      }).catch((err) => {
        this.$toast.open({
          duration: 3000,
          message: 'Could not update event status: ' + err.message,
          type: 'is-danger'
        })
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['oms-events'] + '/mine/approvable').then((response) => {
        this.events = response.data.data

        for (const event of this.events) {
          this.calculateFutureStatuses(event)
        }
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch events list: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    this.fetchData()
  },
  filters: {
    date (val) {
      return moment(val).format('YYYY-MM-DD')
    }
  }
}
</script>
