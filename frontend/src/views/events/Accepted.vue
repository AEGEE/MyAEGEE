<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Accepted applications</div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Body</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in applications" v-bind:key="pax.user_id">
              <td>{{ pax.user_id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.user ? pax.user.first_name + ' ' + pax.user.last_name : 'Loading...' }}
                </router-link>
              </td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: pax.body_id } }">
                  {{ pax.body ? pax.body.name : 'Loading...' }}
                </router-link>
              </td>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td colspan="3">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="3">Loading...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AcceptedParticipantsList',
  data () {
    return {
      applications: [],
      isLoading: false,
      isSaving: false
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  filters: {
    capitalize (value) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['events'] + '/single/' + this.$route.params.id + '/participants?status=accepted').then((applicationResponse) => {
      this.applications = applicationResponse.data.data
      this.isLoading = false

      // Fetching users and bodies.
      for (const application of this.applications) {
        this.axios.get(this.services['core'] + '/members/' + application.user_id).then((user) => {
          const member = user.data.data
          this.$set(application, 'user', member)
          this.$set(application, 'body', member.bodies.find(body => body.id === application.body_id))
        }).catch(console.error)
      }
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
