<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Votes amount</div>

        <div class="subtitle">By antenna</div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Body</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vote in antennae" v-bind:key="vote.id">
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: vote.body_id } }">
                  {{ vote.body ? vote.body.name : 'Loading...' }}
                </router-link>
              </td>
              <td>{{ vote.votes }}</td>
            </tr>
            <tr v-if="antennae.length == 0 && !isLoading">
              <td colspan="2">No votes yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="2">Loading...</td>
            </tr>
          </tbody>
        </table>

        <div class="subtitle">By delegate</div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>User</th>
              <th>Body</th>
              <th>Type</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vote in delegates" v-bind:key="vote.id">
              <td>{{ vote.application.id }}</td>
              <td>{{ vote.application.user_id }}</td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: vote.body_id } }">
                  {{ vote.body ? vote.body.name : 'Loading...' }}
                </router-link>
              </td>
              <td>{{ vote.type }}</td>
              <td>{{ vote.votes }}</td>
            </tr>
            <tr v-if="delegates.length == 0 && !isLoading">
              <td colspan="4">No votes yet!</td>
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
  name: 'VotesAmountsForStatutory',
  data () {
    return {
      antennae: [],
      delegates: [],
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
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/votes-amounts/antenna').then((votes) => {
      this.antennae = votes.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/votes-amounts/delegate')
    }).then((votes) => {
      this.delegates = votes.data.data.sort((a, b) => a.type.localeCompare(b.type))

      this.isLoading = false

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/').then((bodies) => {
        for (const delegate of this.delegates) {
          this.$set(delegate, 'body', bodies.data.data.find(b => b.id === delegate.application.body_id))
        }

        for (const antenna of this.antennae) {
          this.$set(antenna, 'body', bodies.data.data.find(b => b.id === antenna.body_id))
        }
      }).catch(console.error)
    }).catch((err) => {
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
