<template>
  <div>
    <div class="tile is-ancestor">
      <div class="tile is-vertical is-12">
        <div class="tile">
          <div class="tile is-6 is-parent">
            <article class="tile is-child box">
              <p class="title">{{ user.first_name }} {{ user.last_name }}</p>
              <div class="content">
                <p v-show="user.bodies.length > 0">You are member of these bodies:</p>
                <ul v-show="user.bodies.length > 0">
                  <li v-for="body in user.bodies" v-bind:key="body.id">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id} }">{{ body.name }}</router-link>
                  </li>
                </ul>
                <p v-show="user.bodies.length === 0"><i>You are currently not a member of any body.</i></p>

                <p v-show="user.circles.length > 0">You are member of these circles:</p>
                <ul v-show="user.circles.length > 0">
                  <li v-for="circle in user.circles" v-bind:key="circle.id">
                    <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id} }">{{ circle.name }}</router-link>
                  </li>
                </ul>
                <p v-show="user.circles.length === 0"><i>You are currently not a member of any circle.</i></p>

              <b-loading :is-full-page="false" :active.sync="isLoading.user"></b-loading>
            </article>
          </div>
          <div class="tile is-6 is-parent">
            <article class="tile is-child box">
              <p class="title">Events you've applied to</p>
              <div class="content" v-show="events.length > 0">
                <ul>
                  <li v-for="event in events" v-bind:key="event.id">
                    <router-link :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }">
                      {{ event.name }} - {{ event.starts | date }}
                    </router-link>
                  </li>
                </ul>
              </div>
              <div class="content" v-show="events.length === 0">
                <p><i>You haven't appied to any event yet.</i></p>
              </div>
              <b-loading :is-full-page="false" :active.sync="isLoading.events"></b-loading>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Dashboard',
  data () {
    return {
      user: {
        first_name: '',
        last_name: '',
        bodies: [],
        circles: []
      },
      events: [],
      isLoading: {
        user: false,
        events: false
      }
    }
  },
  mounted () {
    this.isLoading.user = true
    this.isLoading.events = true

    this.axios.get(this.services['oms-core-elixir'] + '/members/me').then((response) => {
      this.user = response.data.data
      this.isLoading.user = false
    }).catch((err) => {
      this.isLoading.user = false
      this.$root.showDanger('Could not fetch user: ' + err.message)
    })

    this.axios.get(this.services['oms-events'] + '/mine/participating').then((response) => {
      this.events = response.data.data
      this.isLoading.events = false
    }).catch((err) => {
      this.isLoading.events = false
      this.$root.showDanger('Could not fetch events list: ' + err.message)
    })

    this.axios.get('/services/oms-statutory/').then((response) => {
      this.events = response.data.data
      this.isLoading.events = false
    }).catch((err) => {
      this.isLoading.events = false
      this.$root.showDanger('Could not fetch events list: ' + err.message)
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    isAnythingLoading () {
      return Object.keys(this.isLoading).some(key => this.isLoading[key])
    }
  }
}
</script>
