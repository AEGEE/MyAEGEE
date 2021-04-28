<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Votes amount</div>

        <div class="subtitle">By antenna</div>

        <div class="field">
          <div class="control">
            <a :href="exportVotesTXT.content" :download="exportVotesTXT.filename"><button class="button is-primary">
              Export list of votes
            </button></a>
          </div>
        </div>

        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Body Code</th>
              <th>Body</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vote in antennae" v-bind:key="vote.id">
              <td>{{ vote.body ? vote.body.code : 'Loading...' }}</td>
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
              <td>{{ vote.application.statutory_id }}</td>
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

/**
 * Takes a list of antennas, and returns an object with two properties, TXT content and a filename
 * @param antennae
 * @param eventShortLink the string 'aaa' in the URL http://my.appserver.test/statutory/aaa/votes. Since it's part of the URL, it does comport spaces.
 */
function prepareExportTxt (antennae, eventShortLink) {
  // we're forced to use %09 for tabs and %0A for linebreak.
  const contentT = 'data:text/plain,' + antennae
    .map(antenna => antenna.body.code + '%09' + antenna.votes + '%0A')
    .join('')
  const filenameT = 'exportVotes_' + eventShortLink + '_' + new Date().toISOString() + '.txt'
  return {
    content: contentT,
    filename: filenameT
  }
}

export default {
  name: 'VotesAmountsForStatutory',
  data () {
    return {
      antennae: [],
      delegates: [],
      isLoading: false,
      isSaving: false,
      exportVotesTXT: {
        content: '',
        filename: ''
      }
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/votes-amounts/antenna').then((votes) => {
      this.antennae = votes.data.data

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/votes-amounts/delegate')
    }).then((votes) => {
      this.delegates = votes.data.data.sort((a, b) => a.type.localeCompare(b.type))

      this.isLoading = false

      this.axios.get(this.services['core'] + '/bodies/').then((bodies) => {
        for (const delegate of this.delegates) {
          this.$set(delegate, 'body', bodies.data.data.find(b => b.id === delegate.application.body_id))
        }

        for (const antenna of this.antennae) {
          this.$set(antenna, 'body', bodies.data.data.find(b => b.id === antenna.body_id))
        }
        this.exportVotesTXT = prepareExportTxt(this.antennae, this.$route.params.id)
      }).catch(console.error)
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
