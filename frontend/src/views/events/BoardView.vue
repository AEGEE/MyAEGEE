<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Board-view</div>

        <div class="field" v-if="boardBodies.length > 0">
          <label>Select the body to view application from:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <i class="fa fa-globe"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          v-if="selectedBody && boardBodies.length > 0">
          <template slot-scope="props">
            <b-table-column field="updated_at" label="Date modified" sortable>
              {{ props.row.updated_at | datetime }}
            </b-table-column>

            <b-table-column field="event.name" label="Event" sortable>
              <router-link :to="{ name: 'oms.events.view', params: { id: props.row.event.url } }">
                {{ props.row.event.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="first_name" label="Name" sortable>
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                {{ props.row.first_name }} {{ props.row.last_name  }}
              </router-link>
            </b-table-column>

            <b-table-column field="board_comment" label="Board comment">
              <div class="control">
                <input class="input" v-model="props.row.board_comment" />
              </div>
            </b-table-column>

            <b-table-column label="Save">
              <button type="button" class="button is-primary" @click="submitComment(props.row)">
                <span class="icon"><i class="fa fa-save"></i></span>
                <span>Save</span>
              </button>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BoardView',
  data () {
    return {
      applications: [],
      boardBodies: [],
      isLoading: false,
      selectedBody: null
    }
  },
  methods: {
    submitComment (application) {
      this.axios.put(this.services['oms-events'] + '/single/' + application.event.id + '/applications/' + application.id + '/comment/', {
        board_comment: application.board_comment
      }).then(() => {
        this.$root.showSuccess('Participant comment is updated.')
        application.clean = true
      }).catch((err) => {
        this.$root.showError('Could not update participant comment', err)
      })
    },
    fetchData () {
      if (!this.selectedBody) {
        return
      }

      this.isLoading = true
      this.axios.get(this.services['oms-events'] + '/boardview/' + this.selectedBody).then((response) => {
        this.applications = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showError('Error fetching board view data', err)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    selectedBody () {
      this.fetchData()
    }
  },
  mounted () {
    this.axios.post(this.services['oms-core-elixir'] + '/my_permissions/', {
      action: 'approve_members',
      object: 'events'
    }).then((bodies) => {
      // Getting bodies IDs list from POST /my_permissions. Copied from oms-statutory backend
      const boardIds = bodies.data.data.reduce((acc, val) => acc.concat(val), [])
        .filter(elt => elt.body_id)
        .map(elt => elt.body_id)
        .filter((elt, index, array) => array.indexOf(elt) === index)

      this.boardBodies = this.loginUser.bodies.filter((body) => boardIds.includes(body.id))
    })
  }
}
</script>
