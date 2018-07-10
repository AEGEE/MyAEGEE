<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-4by3">
            <img v-if="!event.head_image || !event.head_image.url" src="https://bulma.io/images/placeholders/640x480.png">
            <img v-if="event.head_image && event.head_image.url" :src="event.head_image.url">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.view_applications">
            <router-link :to="{ name: 'oms.events.participants', params: { id: event.seo_url || event.id } }" class="button is-fullwidth">
              <span>View applications</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.apply">
            <router-link :to="{ name: 'oms.events.apply', params: { id: event.seo_url || event.id } }" class="button is-info is-fullwidth">
              <span>Apply</span>
              <span class="icon"><i class="fa fa-plus"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <router-link :to="{ name: 'oms.events.edit', params: { id: event.seo_url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_organizers">
            <router-link :to="{ name: 'oms.events.edit_organizers', params: { id: event.seo_url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit organizers</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.delete">
            <a class="button is-fullwidth is-danger" @click="askDeleteEvent()">
              <span>Delete event</span>
              <span class="icon"><i class="fa fa-times"></i></span>
            </a>
          </div>
        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ event.name }}</p>

          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Event name</th>
                  <td>{{ event.name }}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>{{ event.description }}</td>
                </tr>
                <tr>
                  <th>Max. participants</th>
                  <td>{{ event.max_participants }}</td>
                </tr>
                <tr>
                  <th>Application status</th>
                  <td>{{ event.application_status }}</td>
                </tr>
                <tr>
                  <th>Application deadline</th>
                  <td v-if="event.application_deadline">{{ event.application_deadline }}</td>
                  <td v-if="!event.application_deadline"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Starts</th>
                  <td>{{ event.starts }}</td>
                </tr>
                <tr>
                  <th>Ends</th>
                  <td>{{ event.ends }}</td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td>{{ event.type }}</td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{{ event.status.name }}</td>
                </tr>
                <tr>
                  <th>Organizers</th>
                  <td>
                    <ul>
                      <li v-for="organizer in event.organizers" v-bind:key="organizer._id">
                        <router-link class="tag" :to="{ name: 'oms.members.view', params: { id: organizer.user_id } }">
                          <span v-if="organizer.user">{{ organizer.user.first_name }} {{ organizer.user.last_name }}</span>
                          <span v-if="!organizer.user">Loading...</span>
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th>Organizing bodies</th>
                  <td>
                    <ul>
                      <li v-for="body in event.organizing_locals" v-bind:key="body._id">
                        <router-link class="tag" :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                          {{ body.body ? body.body.name : 'Loading...' }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SingleEvent',
  data () {
    return {
      event: {
        name: '',
        description: '',
        id: null,
        url: null,
        organizers: [],
        organizing_locals: [],
        circles: [],
        starts: null,
        ends: null,
        application_status: 'closed',
        application_deadline: null,
        head_image: null,
        status: { name: 'Loading...' }
      },
      isLoading: false,
      can: {
        edit: false,
        view_applications: false,
        apply: false
      }
    }
  },
  methods: {

  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.permissions.can
      this.isLoading = false

      for (const body of this.event.organizing_locals) {
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + body.body_id).then((response) => {
          body.body = response.data.data
          this.$forceUpdate()
        }).catch(console.error)
      }

      for (const member of this.event.organizers) {
        this.axios.get(this.services['oms-core-elixir'] + '/members/' + member.user_id).then((response) => {
          member.user = response.data.data
          this.$forceUpdate()
        }).catch(console.error)
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$toast.open({
        duration: 3000,
        message,
        type: 'is-danger'
      })
      this.$router.push({ name: 'oms.events.list' })
    })
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>
