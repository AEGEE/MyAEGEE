<template>
  <div>
    <div class="tile is-ancestor">
      <div class="tile is-vertical is-12">
        <div class="tile">
          <div class="tile is-4 is-parent">
            <article class="tile is-child box" aria-labelledby="dashboard-member">
              <h2 id="dashboard-member" class="title">{{ user.first_name }} {{ user.last_name }}</h2>
              <div class="content">
                <p v-if="hasAnyBodies">You are member of these bodies:</p>
                <ul v-if="hasAnyBodies">
                  <li v-for="body in user.bodies" v-bind:key="body.id">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id } }" :class="bodyClass(body)">{{ body.name }}</router-link>
                  </li>
                </ul>
                <p v-if="!hasAnyBodies"><i>You are currently not a member of any body.</i></p>

                <p v-show="user.circles.length > 0">You are member of these circles:</p>
                <ul v-show="user.circles.length > 0">
                  <li v-for="circle in user.circles" v-bind:key="circle.id">
                    <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id } }">{{ circle.name }}</router-link>
                  </li>
                </ul>
                <p v-show="user.circles.length === 0"><i>You are currently not a member of any circle.</i></p>
              </div>
            </article>
          </div>

          <div class="tile is-4 is-parent is-vertical">
            <article class="tile is-child box" aria-labelledby="dashboard-upcoming" :aria-busy="isLoading.events">
              <h2 id="dashboard-upcoming" class="title">Upcoming events you've applied to</h2>
              <div class="content" v-show="events.future.length > 0">
                <ul>
                  <li v-for="event in events.future" v-bind:key="event.id">
                    <router-link :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }" v-if="constants.STATUTORY_TYPES_NAMES[event.type]">
                      {{ event.name }} - {{ event.starts | date }}
                    </router-link>
                    <router-link :to="{ name: 'oms.summeruniversity.view', params: { id: event.url || event.id } }" v-else-if="constants.SUMMERUNIVERSITY_TYPES_NAMES[event.type]">
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

            <article class="tile is-child box" aria-labelledby="dashboard-past" :aria-busy="isLoading.events">
              <h2 id="dashboard-past" class="title">Past events you've applied to</h2>
              <div class="content" v-show="events.past.length > 0">
                <ul>
                  <li v-for="event in events.past" v-bind:key="event.id">
                    <router-link :to="{ name: 'oms.statutory.view', params: { id: event.url || event.id } }" v-if="constants.STATUTORY_TYPES_NAMES[event.type]">
                      {{ event.name }}
                    </router-link>
                    <router-link :to="{ name: 'oms.summeruniversity.view', params: { id: event.url || event.id } }" v-else-if="constants.SUMMERUNIVERSITY_TYPES_NAMES[event.type]">
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
              <b-loading :is-full-page="false" :active.sync="isLoading.events" />
            </article>
          </div>

          <div class="tile is-4 is-parent">
            <article class="tile is-child box" aria-labelledby="dashboard-statutory" :aria-busy="isLoading.statutory">
              <h2 id="dashboard-statutory" class="title">Statutory events</h2>
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
                        Manage my application
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
              <b-loading :is-full-page="false" :active.sync="isLoading.statutory" />
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
import sortBodies from '../../methods/sort-bodies'

export default {
  name: 'Dashboard',
  data () {
    return {
      constants,
      events: {
        past: [],
        future: []
      },
      statutory: null,
      isLoading: {
        events: false,
        statutory: false
      }
    }
  },
  mounted () {
    this.isLoading.events = true
    this.isLoading.statutory = true

    // The three lists are fetched side by side; one that fails leaves the others shown.
    const lists = [
      { url: this.services['events'] + '/mine/participating', error: 'Could not fetch events list' },
      { url: this.services['statutory'] + '/mine', error: 'Could not fetch statutory events list' },
      { url: this.services['summeruniversity'] + '/mine/participating', error: 'Could not fetch summer university events list' }
    ]
    Promise.all(lists.map(({ url, error }) => this.axios.get(url).then((response) => response.data.data).catch((err) => {
      this.$root.showError(error, err)
      return []
    }))).then((results) => {
      for (const event of [].concat(...results)) {
        if (!event.applications[0].cancelled && event.applications[0].status !== 'rejected') {
          // An event that has started counts as upcoming until it ends.
          if (moment().isSameOrBefore(event.ends)) {
            this.events.future.push(event)
          } else {
            this.events.past.push(event)
          }
        }
      }
      this.events.past.sort((e1, e2) => ((e1.starts < e2.starts) ? 1 : -1))
      this.events.future.sort((e1, e2) => ((e1.starts > e2.starts) ? 1 : -1))
      this.isLoading.events = false
    })

    this.axios.get(this.services['statutory'] + '/events/latest').then((response) => {
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
    // The member as the app fetched them when it started, with their bodies and circles sorted.
    user () {
      return {
        ...this.loginUser,
        bodies: sortBodies(this.loginUser.bodies, this.loginUser.primary_body_id),
        circles: [...this.loginUser.circles].sort((c1, c2) => ((c1.name > c2.name) ? 1 : -1))
      }
    },
    hasAnyBodies () {
      return this.user.primary_body || this.user.bodies.length > 0
    }
  },
  methods: {
    bodyClass (body) {
      return {
        bold: Boolean(this.user.primary_body) && body.name === this.user.primary_body.name,
        'rainbow-text': body.name === 'Information Technology Committee'
      }
    }
  }
}
</script>
