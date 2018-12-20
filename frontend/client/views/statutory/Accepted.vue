<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Accepted applications</div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Body</th>
              <th>Type and order</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in applications" v-bind:key="pax.id">
              <td>{{ pax.id }}</td>
              <td>{{ pax.first_name }} {{ pax.last_name }}</td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: pax.body_id } }">
                  {{ pax.body_name }}
                </router-link>
              </td>
              <td>{{ pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '' }}</td>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td colspan="4">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="4">Loading...</td>
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
  name: 'AcceptedStatutoryList',
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
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/accepted').then((application) => {
      this.applications = application.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
