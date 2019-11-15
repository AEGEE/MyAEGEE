<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div>
        <b-table
          :data="event.organizers"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="id" label="User ID" sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="first_name" label="First and last name" sortable>
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                {{ props.row.first_name }} {{ props.row.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="comment" label="Comment">
              <div class="control">
                <input class="input" type="text" v-model="props.row.comment" @input="props.row.changed = true"/>
              </div>
            </b-table-column>

            <b-table-column label="Save">
              <button :disabled="!props.row.changed" class="button is-small is-primary" @click="saveOrganizer(props.index)">Save</button>
            </b-table-column>

            <b-table-column label="Delete">
              <button v-if="event.organizers.length > 1" class="button is-small is-danger" @click="askDeleteOrganizer(props.index)">
                Delete organizer
              </button>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <div class="field">
          <label class="label">Add organizer</label>
          <div class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autoComplete.members.name"
                :data="autoComplete.members.values"
                open-on-focus="true"
                :loading="autoComplete.members.loading"
                @input="query => fetchMembers(query, 'members', 'members')"
                @select="organizer => addOrganizer(organizer)">
                <template slot-scope="props">
                  <div class="media">
                    <div class="media-content">
                        {{ props.option.first_name }}
                        <br>
                        <small> {{ props.option.last_name }} </small>
                    </div>
                  </div>
                </template>
              </b-autocomplete>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditEvent',
  data () {
    return {
      event: {
        organizers: []
      },
      autoComplete: {
        members: { name: '', values: [], loading: false }
      },
      can: {
        viewAllMembers: false
      },
      errors: {},
      scope: 'organizers',
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    fetchMembers (query) {
      if (!query) return

      this.autoComplete.members.values = []
      this.autoComplete.members.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      // If user has global permission, fetching global members list.
      // Otherwise, fetch all of the members of the bodies this user is a member of.
      const endpoints = this.can.viewAllMembers
        ? [this.services['oms-core-elixir'] + '/members']
        : this.loginUser.bodies.map(body => this.services['oms-core-elixir'] + '/bodies/' + body.id +  '/members')

      Promise.all(endpoints.map(endpoint => {
        // Ignoring the requests that failed (because of 403 most likely)
        // since the user does not always has the permissions to see
        // the members of the body.
        return this.axios.get(endpoint, {
          cancelToken: this.token.token,
          params: { query }
        }).then(res => res.data.data).catch(() => [])
      })).then((responses) => {
        // Merging all of the responses into one array.
        // Then filtering out duplicate users.
        // .map is there because the /bodies/:id/members returns users, not members.
        this.autoComplete.members.values = responses
          .reduce((acc, val) => acc.concat(val), [])
          .map(value => this.can.viewAllMembers ? value : value.member)
          .filter((elt, index, array) => array.findIndex(e => e.id === elt.id) === index)
        this.autoComplete.members.loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete.members.loading = false
        this.$root.showDanger('Could not fetch members: ' + err.message)
      })
    },
    addOrganizer (organizer) {
      const data = {
        user_id: organizer.id
      }
      this.axios.post(this.services['oms-events'] + '/single/' + this.event.id + '/organizers', data).then((response) => {
        this.$root.showSuccess('Organizer is successfully added.')

        this.event.organizers.push({
          user_id: organizer.id,
          user: organizer,
          first_name: organizer.first_name,
          last_name: organizer.last_name
        })
      }).catch((err) => {
        this.$root.showDanger('Could not add organizer: ' + err.message)
      })
    },
    saveOrganizer (index) {
      const organizer = this.event.organizers[index]

      const data = {
        comment: organizer.comment
      }

      this.axios.put(this.services['oms-events'] + '/single/' + this.event.id + '/organizers/' + organizer.user_id, data).then((response) => {
        this.$root.showSuccess('Organizer is successfully updated.')
        this.$set(organizer, 'changed', false)
      }).catch((err) => {
        this.$root.showDanger('Could not update organizer: ' + err.message)
      })
    },
    askDeleteOrganizer (index) {
      this.$buefy.dialog.confirm({
        title: 'Deleting organizer',
        message: 'Are you sure you want to <b>delete</b> organizer from this event? This action cannot be undone.',
        confirmText: 'Delete organizer',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteOrganizer(index)
      })
    },
    deleteOrganizer (index) {
      const organizer = this.event.organizers[index]
      this.axios.delete(this.services['oms-events'] + '/single/' + this.event.id + '/organizers/' + organizer.user_id).then((response) => {
        this.$root.showSuccess('Organizer is successfully deleted.')
        this.event.organizers.splice(index, 1)
      }).catch((err) => {
        this.$root.showDanger('Could not delete organizer: ' + err.message)
      })
    }
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  }),
  mounted () {
    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      this.event.starts = new Date(this.event.starts)
      this.event.ends = new Date(this.event.ends)
      if (this.event.application_deadline) this.event.application_deadline = new Date(this.event.application_deadline)

      return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions/')
    }).then((response) => {
      this.can.viewAllMembers = response.data.data.some(permission => permission.combined.endsWith('global:view:member'))

      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
