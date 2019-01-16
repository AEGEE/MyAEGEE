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
                <td>{{ event.status }}</td>
                <td>
                  <button class="button is-small is-primary" @click="publishEvent(event)">Publish</button>
                </td>
              </tr>
              <tr v-show="!events.length && !isLoading">
                <td colspan="6" class="has-text-centered">There are no events for which you can change status.</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="6" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
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
    publishEvent (event) {
      this.axios.put(this.services['oms-events'] + '/single/' + event.id + '/status', {
        status: 'published'
      }).then(() => {
        this.$root.showSuccess('Event status is now "published".')

        this.events.splice(this.events.indexOf(event), 1)
      }).catch((err) => {
        this.$root.showDanger('Could not update event status: ' + err.message)
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['oms-events'] + '/mine/approvable').then((response) => {
        this.events = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not fetch events list: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
