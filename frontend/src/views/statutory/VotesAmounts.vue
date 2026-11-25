<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Votes amount</h1>

        <h2 id="votes-by-antenna" class="subtitle">By antenna</h2>

        <div class="field">
          <div class="control">
            <a v-if="exportVotesTXT.content" class="button is-primary" :href="exportVotesTXT.content" :download="exportVotesTXT.filename">
              Export list of votes
            </a>
          </div>
        </div>

        <table class="table is-narrow is-fullwidth" aria-labelledby="votes-by-antenna">
          <thead>
            <tr>
              <th>Body Code</th>
              <th>Body</th>
              <th>Votes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vote in antennae" v-bind:key="vote.id">
              <td>{{ vote.body ? vote.body.code : (isLoadingBodies ? 'Loading...' : '-') }}</td>
              <td>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: vote.body_id } }">
                  {{ bodyName(vote) }}
                </router-link>
              </td>
              <td>{{ vote.votes }}</td>
            </tr>
            <tr v-if="antennae.length == 0 && !isLoading">
              <td colspan="3">No votes yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="3">Loading...</td>
            </tr>
          </tbody>
        </table>

        <h2 id="votes-by-delegate" class="subtitle">By delegate</h2>

        <table class="table is-narrow is-fullwidth" aria-labelledby="votes-by-delegate">
          <thead>
            <tr>
              <th>Statutory ID</th>
              <th>User ID</th>
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
                  {{ bodyName(vote) }}
                </router-link>
              </td>
              <td>{{ vote.type }}</td>
              <td>{{ vote.votes }}</td>
            </tr>
            <tr v-if="delegates.length == 0 && !isLoading">
              <td colspan="5">No votes yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="5">Loading...</td>
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
 * An antenna whose body core doesn't list (any more) is exported by its body ID: '#12'.
 * @param antennae
 * @param eventShortLink the string 'aaa' in the URL http://my.appserver.test/statutory/aaa/votes. Since it's part of the URL, it does comport spaces.
 */
function prepareExportTxt (antennae, eventShortLink) {
  // we're forced to use %09 for tabs and %0A for linebreak.
  const contentT = 'data:text/plain,' + antennae
    .map(antenna => (antenna.body ? antenna.body.code : '%23' + antenna.body_id) + '%09' + antenna.votes + '%0A')
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
      isLoadingBodies: true,
      exportVotesTXT: {
        content: '',
        filename: ''
      }
    }
  },
  computed: mapGetters({
    services: 'services'
  }),
  methods: {
    // Core lists the active bodies only, so the body of an old vote may not be among them.
    bodyName (vote) {
      if (vote.body) {
        return vote.body.name
      }

      return this.isLoadingBodies ? 'Loading...' : `Unknown body (#${vote.body_id})`
    }
  },
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
        this.isLoadingBodies = false
        this.exportVotesTXT = prepareExportTxt(this.antennae, this.$route.params.id)
      }).catch((err) => {
        this.isLoadingBodies = false
        this.$root.showError('Could not fetch bodies', err)
      })
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
