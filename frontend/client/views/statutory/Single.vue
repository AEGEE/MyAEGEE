<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img src="/images/logo.png">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped">
            <router-link :to="{ name: 'oms.statutory.manage_participants', params: { id: event.url || event.id } }" class="button is-fullwidth" v-if="can.manage_applications">
              <span>View applications</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped">
            <router-link :to="{ name: 'oms.statutory.accepted', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Participants list</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="canAccessBoardview">
            <router-link :to="{ name: 'oms.statutory.boardview', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Board view</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="canAccessBoardview">
            <router-link :to="{ name: 'oms.statutory.memberslist.upload', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>Manage members list</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.see_memberslists">
            <router-link :to="{ name: 'oms.statutory.memberslist.list', params: { id: event.url || event.id } }" class="button is-fullwidth">
              <span>See members list</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.apply">
            <router-link :to="{ name: 'oms.statutory.apply', params: { id: event.url || event.id } }" class="button is-warning is-fullwidth">
              <span>Apply</span>
              <span class="icon"><i class="fa fa-plus"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <router-link :to="{ name: 'oms.statutory.edit', params: { id: event.url || event.id } }" class="button is-fullwidth is-warning">
              <span>Edit event</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit_event">
            <a @click="askSwitchStatus('draft')" v-if="event.status === 'published'" class="button is-danger is-fullwidth">
              <span>Unpublish</span>
              <span class="icon"><i class="fa fa-pen"></i></span>
            </a>

            <a @click="askSwitchStatus('published')" v-if="event.status === 'draft'" class="button is-info is-fullwidth">
              <span>Publish</span>
              <span class="icon"><i class="fa fa-globe"></i></span>
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
                  <td>
                    <div class="content" v-html="$options.filters.markdown(event.description)"></div>
                  <td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td v-if="event.type === 'agora'">Agora</td>
                  <td v-if="event.type === 'epm'">EPM</td>
                </tr>
                <tr>
                  <th>Starts</th>
                  <td>{{ event.starts | date }}</td>
                </tr>
                <tr>
                  <th>Ends</th>
                  <td>{{ event.ends | date }}</td>
                </tr>
                <tr>
                  <th>Fee</th>
                  <td v-if="event.fee">€{{ event.fee }}</td>
                  <td v-if="!event.fee"><i>Free</i></td>
                </tr>
                <tr>
                  <th>Organizing body</th>
                  <td>
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: event.body_id } }">
                      {{ event.body ? event.body.name : 'Loading...' }}
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child">
        <div class="content">
          <p class="subtitle">Deadlines</p>
          <div class="content">
            <p>Please keep in mind that the dates are in your localtime, which is not necessarily CET.</p>
            <table class="table is-narrow">
              <thead>
                <tr>
                  <th></th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Application period</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.application_period_ends | datetime }}</td>
                </tr>
                <tr>
                  <th>Board approval</th>
                  <td>{{ event.application_period_starts | datetime }}</td>
                  <td>{{ event.board_approve_deadline | datetime }}</td>
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
  name: 'SingleStatutory',
  data () {
    return {
      event: {
        name: '',
        description: '',
        id: null,
        url: null,
        body_id: null,
        body: null,
        status: null
      },
      isLoading: false,
      can: {
        edit_event: false,
        change_event_status: false,
        delete_event: false,
        apply: false,
        set_board_comment_and_participant_type: {},
        see_memberslists: false
      }
    }
  },
  methods: {
    askSwitchStatus (newStatus) {
      this.$dialog.confirm({
        title: 'Switching status',
        message: `Are you sure you want to <b>switch this event's status to "${newStatus}"</b>?`,
        confirmText: 'Switch status',
        type: 'is-info',
        hasIcon: true,
        onConfirm: () => this.switchStatus(newStatus)
      })
    },
    switchStatus (newStatus) {
      this.axios.put(this.services['oms-statutory'] + '/events/' + this.event.id + '/status', { status: newStatus }).then((response) => {
        this.$root.showInfo('Status is updated.')
        this.event.status = newStatus
      }).catch((err) => this.$root.showDanger('Could not update status: ' + err.message))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.event.body_id)
    }).then((response) => {
      this.event.body = response.data.data

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.response.data.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    canAccessBoardview () {
      return Object.keys(this.can.set_board_comment_and_participant_type)
        .filter(key => this.can.set_board_comment_and_participant_type[key])
        .length > 0
    }
  }
}
</script>
