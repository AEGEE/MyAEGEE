
<template>
  <div>
    <ul>
      <li v-for="event in events">
        <router-link :to='{name: "oms.alastair.organizer.event", params: {id: event.id}}'>{{ event.name }}</router-link>
      </li>
    </ul>
    <span v-show="!isLoading && (!events || events.length == 0)">No events in the database, create one</span>
    <span v-show="isLoading">Fetching events from database</span>

    <hr>
    <h4>Create an event</h4>

    <div class="form-group">
      <label>Name</label>
      <input class="form-control" v-model="newEventName" type="text" placeholder="name">
      <button type="button" v-on:click="createEvent(newEventName)" class="btn btn-primary">Create new event</button>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AlastairMyEvents',
  data () {
    return {
      events: [],
      isLoading: false,
      newEventName: ''
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    createEvent () {
      this.axios.post(this.services['alastair'] + '/events', {event: {name: this.newEventName}})
        .then((response) => {
          this.fetchData()
        }).catch((err) => {
          this.$root.showDanger('Could not create event: ' + err.message)
        })
    },
    refetch () {
      this.events = []
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/events', { cancelToken: this.source.token })
        .then((response) => {
          this.isLoading = false
          this.events = response.data.data
        }).catch((err) => {
          if (this.axios.isCancel(err)) {
            return console.debug('Request cancelled.')
          }

          this.$root.showDanger('Could not fetch alastair events list: ' + err.message)
        })
    }
  },
  watch: {
    '$route.name' () {
      this.fetchData()
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
