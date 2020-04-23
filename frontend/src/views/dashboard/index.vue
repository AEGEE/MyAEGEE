<template>
  <div>
    <div class="tile is-ancestor">
      <div class="tile is-vertical is-12">
        <div class="tile">
          <div class="tile is-4 is-parent">
            <article class="tile is-child box">
              <p class="title">{{ user.first_name }} {{ user.last_name }}</p>
              <div class="content">
                <p v-if="hasAnyBodies">You are member of these bodies:</p>
                <ul v-if="hasAnyBodies">
                  <li v-for="body in addStyle" v-bind:key="body.id">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id} }" :class="body.class">{{ body.name }}</router-link>
                  </li>
                </ul>
                <p v-if="!hasAnyBodies"><i>You are currently not a member of any body.</i></p>

                <p v-show="user.circles.length > 0">You are member of these circles:</p>
                <ul v-show="user.circles.length > 0">
                  <li v-for="circle in user.circles" v-bind:key="circle.id">
                    <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id} }">{{ circle.name }}</router-link>
                  </li>
                </ul>
                <p v-show="user.circles.length === 0"><i>You are currently not a member of any circle.</i></p>

                <b-loading :is-full-page="false" :active.sync="isLoading.user"></b-loading>
              </div>
            </article>
          </div>

          <div class="tile is-4 is-parent is-vertical">
            <article class="tile is-child box">
              <p class="title">Upcoming events you’ve applied to</p>
              <div class="content" v-show="events.future.length > 0">
                <ul>
                  <li v-for="event in events.future" v-bind:key="event.id">
                    <router-link :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }" v-if="constants.STATUTORY_TYPES_NAMES[event.type]">
                      {{ event.name }} - {{ event.starts | date }}
                    </router-link>
                    <router-link :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }" v-else>
                      {{ event.name }} - {{ event.starts | date }}
                    </router-link>
                  </li>
                </ul>
              </div>
              <div class="content" v-show="events.future.length === 0">
                <p><i>You haven't applied to any upcoming events yet.</i></p>
              </div>
            </article>

            <article class="tile is-child box">
              <p class="title">Past events you've applied to</p>
              <div class="content" v-show="events.past.length > 0">
                <ul>
                <li v-for="event in events.past" v-bind:key="event.id">
                  <router-link :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }" v-if="constants.STATUTORY_TYPES_NAMES[event.type]">
                    {{ event.name }}
                  </router-link>
                  <router-link :to="{ name: 'oms.events.view', params: { id: event.url || event.id } }" v-else>
                    {{ event.name }}
                  </router-link>
                </li>
                </ul>
              </div>
              <div class="content" v-show="events.past.length === 0">
                <p><i>You haven't applied to any past events yet.</i></p>
              </div>
              <b-loading :is-full-page="false" :active.sync="isLoading.events"></b-loading>
            </article>
          </div>

          <div class="tile is-4 is-parent">
            <article class="tile is-child box">
              <p class="title">Statutory events</p>
              <div class="content">
                <strong>Latest statutory event</strong>
                <ul v-if="!statutory">
                  <li>No statutory events published</li>
                </ul>
                <ul v-if="statutory">
                  <li>
                    <strong>
                      <router-link :to="{ name: 'oms.statutory.view', params: { id: statutory.url || statutory.id } }">
                        {{ statutory.name }}
                      </router-link>
                    </strong>
                  </li>
                  <li>
                    <strong>Dates: </strong>
                    {{ statutory.starts | date }} - {{ statutory.ends | date }}
                  </li>
                  <li>
                    <strong>Application period: </strong>
                    {{ statutory.application_period_starts | datetime }} - {{ statutory.application_period_ends | datetime }}
                  </li>
                  <li v-show="statutory.can_apply && new Date() > new Date(statutory.application_period_starts)">
                    <strong>
                      <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: statutory.url || statutory.id, application_id: 'me' } }">
                        {{ statutory.can_apply ? 'Manage my application' : 'Update my application' }}
                      </router-link>
                    </strong>
                  </li>
                  <li v-show="statutory && statutory.permissions && statutory.permissions.see_participants_list">
                    <strong>
                      <router-link :to="{ name: 'oms.statutory.accepted', params: { id: statutory.url || statutory.id } }">
                        See participants
                      </router-link>
                    </strong>
                  </li>
                </ul>
              </div>
              <b-loading :is-full-page="false" :active.sync="isLoading.statutory"></b-loading>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'
import constants from '../../constants.js'

export default {
  name: 'Dashboard',
  data () {
    return {
      constants,
      user: {
        first_name: '',
        last_name: '',
        primary_body: null,
        bodies: [],
        circles: []
      },
      events: {
        past: [],
        future: []
      },
      statutory: null,
      isLoading: {
        user: false,
        events: false,
        statutory: false
      }
    }
  },
  mounted () {
    this.isLoading.user = true
    this.isLoading.events = true
    this.isLoading.statutory = true

    this.axios.get(this.services['oms-core-elixir'] + '/members/me').then((response) => {
      this.user = response.data.data
      this.user.bodies.sort((b1, b2) => ((b1.name > b2.name) ? 1 : -1))
      this.user.circles.sort((c1, c2) => ((c1.name > c2.name) ? 1 : -1))
      this.isLoading.user = false
    }).catch((err) => {
      this.isLoading.user = false
      this.$root.showError('Could not fetch user', err)
    })

    this.axios.get(this.services['oms-events'] + '/mine/participating').then((eventsResponse) => {
      this.axios.get(this.services['oms-statutory'] + '/mine').then((statutoryResponse) => {
        const input = eventsResponse.data.data.concat(statutoryResponse.data.data)
        for (const event of input) {
          if (moment().isSameOrBefore(event.starts)) {
            this.events.future.push(event)
          } else {
            this.events.past.push(event)
          }
        }
        this.events.past.sort((e1, e2) => ((e1.starts < e2.starts) ? 1 : -1))
        this.events.future.sort((e1, e2) => ((e1.starts > e2.starts) ? 1 : -1))
        this.isLoading.events = false
      }).catch((err) => {
        this.isLoading.events = false
        this.$root.showError('Could not fetch statutory events list', err)
      })
    }).catch((err) => {
      this.isLoading.events = false
      this.$root.showError('Could not fetch events list', err)
    })

    this.axios.get(this.services['oms-statutory'] + '/events/latest').then((response) => {
      this.$set(this, 'statutory', response.data.data)
      this.isLoading.statutory = false
    }).catch((err) => {
      this.isLoading.statutory = false
      if (err.response && err.response.status && err.response.status !== 404) {
        this.$root.showError('Could not fetch latest statutory event', err)
      }
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    isAnythingLoading () {
      return Object.keys(this.isLoading).some(key => this.isLoading[key])
    },
    hasAnyBodies () {
      return this.user.primary_body || this.user.bodies.length > 0
    },
    addStyle () {
      for (const item of this.user.bodies) {
        item.class = []
        if (this.user.primary_body && item.name === this.user.primary_body.name) {
          item.class.push('bold')
        }
        if (item.name === 'Information Technology Committee') {
          item.class.push('rainbow-text')
        }
      }
      return this.user.bodies
    }
  }
}
</script>
