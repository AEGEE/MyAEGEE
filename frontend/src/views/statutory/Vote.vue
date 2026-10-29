<template>
  <div class="voting-page">
    <div v-if="!voting && !isLoading">
      <p class="voting-eyebrow">{{ event.name }}</p>
      <h1 class="title is-4">Votings</h1>
      <div class="notification is-info is-light">
        <p>There is no voting in this Agora yet.</p>
        <p>When the Juridical Commission opens a voting, it appears on this page by itself. You do not need to reload.</p>
      </div>
    </div>

    <template v-if="voting">
      <p class="voting-eyebrow">{{ event.name }}</p>
      <h1 class="title is-4 mb-2">{{ voting.title }}</h1>
      <div class="tags mb-2">
        <span class="tag" :class="status.type">{{ status.label }}</span>
        <span class="tag" :class="result.type" v-if="result">{{ result.label }}</span>
        <span class="tag">{{ kindNames[voting.kind] }}</span>
        <span class="tag">{{ majorityNames[voting.majority] }}</span>
        <span class="voting-live" v-if="voting.status === 'open'">Live</span>
      </div>
      <p class="has-text-grey is-size-7 mb-4" v-if="voting.status === 'open'">
        You can vote until {{ voting.closes_at | datetime }} (your local time).
      </p>
      <p class="has-text-grey is-size-7 mb-4" v-else>Closed at {{ voting.closed_at | datetime }}.</p>

      <div class="voting-columns">
        <div>
          <!-- Open voting -->
          <template v-if="voting.status === 'open'">
            <div class="notification is-info is-light" v-if="noVotes">
              <div class="voting-notification-head"><font-awesome-icon icon="info-circle" /><span>You have no votes in this voting</span></div>
              <p>Only delegates who were registered and present when the voting opened can vote.</p>
            </div>

            <div class="notification is-danger is-light" role="alert" v-else-if="departed">
              <div class="voting-notification-head"><font-awesome-icon icon="exclamation-triangle" /><span>Your vote was not counted</span></div>
              <p>You are registered as departed from {{ event.name }}, or your application is cancelled. Departed delegates can not vote.</p>
              <p>If this is wrong, contact the Juridical Commission.</p>
            </div>

            <template v-else-if="myVote && myVote.submitted_at">
              <div class="notification is-success is-light mb-4" role="status">
                <div class="voting-notification-head">
                  <font-awesome-icon icon="check" /><span>{{ alreadyVoted ? 'You already voted' : 'Your vote is recorded' }}</span>
                </div>
                <p>{{ ownVoteText }} Recorded at {{ myVote.submitted_at | datetimeseconds }}.</p>
                <p v-if="alreadyVoted">Only the first vote counts. Nothing changed.</p>
              </div>
              <p class="mb-2">The result is shown here after the voting closes and the Juridical Commission publishes it.</p>
              <p class="has-text-grey is-size-7">The next voting appears on this page by itself. You do not need to reload.</p>
            </template>

            <template v-else-if="myVote">
              <div class="notification mb-4" :class="refusal.kind === 'network' ? 'is-warning is-light' : 'is-danger is-light'" role="alert" v-if="refusal">
                <div class="voting-notification-head">
                  <font-awesome-icon :icon="refusal.kind === 'network' ? 'wifi' : 'exclamation-triangle'" /><span>{{ refusal.title }}</span>
                </div>
                <p v-for="line in refusal.lines" :key="line">{{ line }}</p>
              </div>

              <div class="notification is-info is-light" v-if="noVotesLeft && phase === 'form'">
                <div class="voting-notification-head"><font-awesome-icon icon="info-circle" /><span>{{ noVotesLeft.title }}</span></div>
                <p>{{ noVotesLeft.line }}</p>
              </div>

              <template v-else-if="phase === 'form'">
                <div class="voting-allowance mb-4">
                  <div class="has-text-grey is-size-7">You vote for {{ bodyName }}</div>
                  <div class="voting-allowance-range">
                    {{ allowance.range }}
                    <span class="voting-dots" aria-hidden="true">
                      <i v-for="index in allowance.guaranteedDots" :key="index" />
                      <i class="is-extra" v-if="allowance.extraFree" />
                    </span>
                  </div>
                  <details class="mt-2">
                    <summary>How is this calculated?</summary>
                    <p v-for="line in allowance.explanation" :key="line">{{ line }}</p>
                    <p>Voting is not required. If you vote, use 1 vote or more.</p>
                  </details>
                </div>

                <h2 class="title is-6 mb-2">Your vote</h2>
                <div class="voting-step-row" v-for="choice in choices" :key="choice.field">
                  <span class="voting-choice"><span class="voting-swatch" :class="'is-' + choice.field" />{{ choice.label }}</span>
                  <span class="voting-stepper">
                    <button :aria-label="'Less ' + choice.label" :disabled="counts[choice.field] === 0" @click="counts[choice.field]--">&minus;</button>
                    <output>{{ counts[choice.field] }}</output>
                    <button :aria-label="'More ' + choice.label" :disabled="used >= allowance.available" @click="counts[choice.field]++">+</button>
                  </span>
                </div>
                <div class="voting-sum-line">
                  <span><strong>{{ used }}</strong> of {{ allowance.available }} votes assigned</span>
                  <span class="has-text-grey" v-if="used === 0">Choose at least 1 vote</span>
                </div>
                <div class="notification is-info is-light voting-compact-notification mt-2" v-if="unusedNote">{{ unusedNote }}</div>
                <div class="notification is-warning is-light voting-compact-notification mt-2" v-if="used > allowance.available">
                  Your body has fewer votes left now. You can cast at most {{ allowance.available }}. Take some votes away.
                </div>
                <div class="voting-sticky-actions">
                  <button class="button is-primary is-fullwidth is-medium" :disabled="used === 0 || used > allowance.available" @click="review()">
                    Review my vote
                  </button>
                </div>
              </template>

              <template v-else>
                <h2 class="title is-5 mb-2">Check your vote</h2>
                <p class="mb-4">You vote for {{ bodyName }} on <strong>{{ voting.title }}</strong>.</p>
                <div class="voting-confirm-list mb-4">
                  <div v-for="choice in choices" :key="choice.field"><span>{{ choice.label }}</span><b>{{ counts[choice.field] }}</b></div>
                  <div><span>Total</span><b>{{ used }} of {{ allowance.available }}</b></div>
                </div>
                <div class="notification is-warning is-light mb-4">
                  <div class="voting-notification-head"><font-awesome-icon icon="info-circle" /><span>This is final</span></div>
                  <p>After you confirm, you can not change your vote.</p>
                </div>
                <div class="voting-sticky-actions">
                  <div class="buttons voting-confirm-buttons">
                    <button class="button is-light" :disabled="phase === 'sending'" @click="change()">Change</button>
                    <button class="button is-primary is-medium" :class="{ 'is-loading': phase === 'sending' }" @click="confirm()">
                      {{ refusal && refusal.retry ? 'Try again' : 'Confirm vote' }}
                    </button>
                  </div>
                </div>
              </template>
            </template>
          </template>

          <!-- Closed voting -->
          <template v-else>
            <div class="notification is-danger is-light mb-4" role="alert" v-if="closedWhileVoting">
              <router-link class="button is-primary is-fullwidth mb-3 voting-next-button" v-if="nextOpenVoting" :to="{ query: { voting: nextOpenVoting.id } }">
                {{ nextOpenVoting.title }} is open now
              </router-link>
              <div class="voting-notification-head"><font-awesome-icon icon="exclamation-triangle" /><span>This voting is closed</span></div>
              <p>The voting closed at {{ voting.closed_at | datetime }}. Your vote was not counted.</p>
            </div>

            <div class="notification is-success is-light mb-4" v-if="myVote && myVote.submitted_at">
              <div class="voting-notification-head"><font-awesome-icon icon="check" /><span>Your vote</span></div>
              <p>{{ ownVoteText }} Recorded at {{ myVote.submitted_at | datetimeseconds }}.</p>
            </div>

            <template v-if="resultData">
              <voting-result :result="resultData" class="mb-4" />
              <h2 class="title is-6 mb-2">Votes per body</h2>
              <voting-bodies-table :rows="resultRows" with-tally />
            </template>
            <p v-else-if="!voting.published">The Juridical Commission publishes the result after the voting closes. It is shown here then.</p>

            <p class="has-text-grey is-size-7 mt-4" v-if="!closedWhileVoting">The next voting appears on this page by itself. You do not need to reload.</p>
          </template>
        </div>

        <aside class="voting-aside">
          <template v-if="voting.description">
            <h4>About this {{ kindNames[voting.kind].toLowerCase() }}</h4>
            <div class="content mb-4" v-html="$options.filters.markdown(voting.description)" />
          </template>
          <h4>Votings in this Agora</h4>
          <ul class="voting-agenda">
            <li v-for="item in votings" :key="item.id" :class="{ 'is-selected': item.id === voting.id }">
              <router-link :to="{ query: { voting: item.id } }">{{ item.title }}</router-link>
              <span class="tag" :class="agendaTag(item).type">{{ agendaTag(item).label }}</span>
            </li>
          </ul>
        </aside>
      </div>
    </template>

    <b-loading :is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import VotingResult from './VotingResult.vue'
import VotingBodiesTable from './VotingBodiesTable.vue'
import {
  CHOICES,
  KIND_NAMES,
  MAJORITY_NAMES,
  autoSwitchTarget,
  closedWithUnsentVote,
  delegateVotings,
  describeAllowance,
  explainRefusal,
  myVoteState,
  noVotesLeftNotice,
  openVotingWithoutVote,
  pickVoting,
  resultTag,
  statusTag,
  totalVotes,
  unusedVotesNote
} from '../../votings'

// How often the page asks for the votings and the own votes, so that a voting that opens
// or closes and the votes of the other delegates of the body show up without a reload.
const REFRESH_MS = 5000

const emptyCounts = () => ({ in_favour: 0, against: 0, abstention: 0 })

const NETWORK_REFUSAL = {
  kind: 'network',
  retry: true,
  title: 'Your vote is not sent yet',
  lines: [
    'There is no connection to MyAEGEE. Your vote is still on this screen. Press "Try again" when you are back online.',
    'You can not vote twice: if the first try did arrive, MyAEGEE keeps only that one.'
  ]
}

// The delegate votes here: one form per voting with in favour, against and abstention,
// a check step, and then one request. The statutory service and its database decide whether
// the vote is valid; when they refuse, this page reads the own votes again and explains in the form
// what happened and what the delegate can do now.
export default {
  name: 'StatutoryVote',
  components: { VotingResult, VotingBodiesTable },
  data () {
    return {
      choices: CHOICES,
      kindNames: KIND_NAMES,
      majorityNames: MAJORITY_NAMES,
      event: { id: null, name: '' },
      votings: [],
      bodies: {},
      selectedId: null,
      chosenByUser: false,
      myVote: null,
      myVoteRequest: 0,
      noVotes: false,
      departed: false,
      closedWhileVoting: false,
      alreadyVoted: false,
      // Votings that are done for this delegate: voted, or no votes in them.
      doneIds: [],
      // The open voting that the notice of a closed voting points to (see pointToNextVoting).
      nextVotingId: null,
      resultData: null,
      phase: 'form',
      counts: emptyCounts(),
      refusal: null,
      isLoading: false,
      timer: null
    }
  },
  computed: {
    ...mapGetters(['services']),
    voting () {
      return this.votings.find((voting) => voting.id === this.selectedId) || null
    },
    status () {
      return statusTag(this.voting)
    },
    result () {
      return resultTag(this.voting)
    },
    bodyName () {
      return this.myVote ? this.bodyNameOf(this.myVote.body_id) : ''
    },
    allowance () {
      return describeAllowance(this.myVote, this.bodyName)
    },
    nextOpenVoting () {
      return this.votings.find((voting) => voting.id === this.nextVotingId) || null
    },
    noVotesLeft () {
      return noVotesLeftNotice(this.myVote, this.bodyName)
    },
    used () {
      return totalVotes(this.counts)
    },
    unusedNote () {
      return unusedVotesNote(this.used, this.allowance, this.bodyName)
    },
    ownVoteText () {
      const { in_favour: inFavour, against, abstention } = this.myVote
      return `${inFavour} in favour, ${against} against, ${abstention} abstention.`
    },
    resultRows () {
      return this.resultData.bodies.map((body) => ({ ...body, name: this.bodyNameOf(body.body_id) }))
    },
    votingsUrl () {
      return this.services['statutory'] + '/events/' + this.event.id + '/votings'
    }
  },
  watch: {
    '$route.query.voting': function (votingId) {
      if (votingId) {
        this.chosenByUser = true
        this.select(Number(votingId))
      }
    }
  },
  methods: {
    bodyNameOf (bodyId) {
      return this.bodies[bodyId] ? this.bodies[bodyId].name : 'Body ' + bodyId
    },
    agendaTag (voting) {
      return resultTag(voting) || statusTag(voting)
    },
    pickVoting () {
      return pickVoting(this.votings, this.doneIds)
    },
    // Every read or write of the own vote takes a new number. An answer that arrives
    // after a newer request, or after the delegate chose another voting, is dropped.
    startMyVoteRequest () {
      this.myVoteRequest++
      return { request: this.myVoteRequest, votingId: this.selectedId }
    },
    isCurrent ({ request, votingId }) {
      return request === this.myVoteRequest && votingId === this.selectedId
    },
    markDone (votingId) {
      if (!this.doneIds.includes(votingId)) this.doneIds.push(votingId)
    },
    async checkMyVote (votingId) {
      let state
      try {
        const response = await this.axios.get(this.votingsUrl + '/' + votingId + '/my-vote')
        state = myVoteState(response.data.data, null)
      } catch (err) {
        state = myVoteState(null, err.response ? err.response.status : null)
      }
      if (state === 'done') this.markDone(votingId)
      return state
    },
    // The page only knows the own vote of the voting it shows. Right before it moves to an open voting
    // by itself, or points the delegate to one, it asks whether the delegate already voted there
    // (for example on another device) or has no votes in it, and then chooses again without that voting.
    async verifiedChoice (choose) {
      for (;;) {
        const votingId = choose()
        const voting = this.votings.find((candidate) => candidate.id === votingId)
        if (!voting || voting.status !== 'open' || this.doneIds.includes(votingId)) return votingId
        if (await this.checkMyVote(votingId) !== 'done') return votingId
      }
    },
    async pointToNextVoting () {
      const candidate = openVotingWithoutVote(this.votings, this.doneIds)
      if (!this.closedWhileVoting || !candidate) {
        this.nextVotingId = null
        return
      }
      if (candidate.id === this.nextVotingId) return

      const votingId = await this.verifiedChoice(() => {
        const next = openVotingWithoutVote(this.votings, this.doneIds)
        return next ? next.id : null
      })
      if (this.closedWhileVoting) this.nextVotingId = votingId
    },
    async select (votingId) {
      if (!this.votings.some((voting) => voting.id === votingId)) {
        votingId = this.pickVoting()
      }
      if (votingId === this.selectedId) return

      this.selectedId = votingId
      this.myVote = null
      this.noVotes = false
      this.departed = false
      this.closedWhileVoting = false
      this.nextVotingId = null
      this.alreadyVoted = false
      this.resultData = null
      this.refusal = null
      this.phase = 'form'
      this.counts = emptyCounts()
      await this.loadMyVote()
      await this.loadResult()
    },
    async loadMyVote () {
      if (!this.voting) return

      const ticket = this.startMyVoteRequest()
      try {
        const response = await this.axios.get(this.votingsUrl + '/' + ticket.votingId + '/my-vote')
        if (!this.isCurrent(ticket)) return
        this.myVote = response.data.data
        if (this.myVote.submitted_at) this.markDone(ticket.votingId)
      } catch (err) {
        if (!this.isCurrent(ticket)) return
        if (err.response && err.response.status === 403) {
          this.noVotes = true
        } else if (err.response) {
          this.$root.showError('Could not load your votes', err)
        }
      }
    },
    async loadResult () {
      if (!this.voting || this.voting.status !== 'closed' || !this.voting.published) return

      try {
        const response = await this.axios.get(this.votingsUrl + '/' + this.voting.id + '/result')
        this.resultData = response.data.data
      } catch (err) {
        if (err.response) this.$root.showError('Could not load the result', err)
      }
    },
    async loadVotings () {
      const response = await this.axios.get(this.votingsUrl)
      this.votings = delegateVotings(response.data.data)
    },
    // Runs every few seconds: picks up votings that open and close,
    // and the votes that the other delegates of the body cast meanwhile.
    async refresh () {
      const previous = this.voting ? { status: this.voting.status, published: this.voting.published } : null

      try {
        await this.loadVotings()
      } catch (err) {
        return // A lost connection shows up when the delegate votes; the next refresh tries again.
      }

      const justClosed = previous && previous.status === 'open' && this.voting && this.voting.status === 'closed' && this.phase !== 'sending'
      if (justClosed && closedWithUnsentVote(this.myVote, this.phase, this.used)) {
        this.closedWhileVoting = true
      }

      if (!this.chosenByUser || !this.voting) {
        const holding = this.phase !== 'form' || this.closedWhileVoting
        const target = await this.verifiedChoice(() => autoSwitchTarget(this.votings, this.doneIds, this.voting, holding))
        if (target !== null && !this.chosenByUser) {
          await this.select(target)
          return
        }
      }

      if (!this.voting) return
      await this.pointToNextVoting()

      if (justClosed) {
        await this.loadMyVote()
      } else if (this.voting.status === 'open' && this.phase === 'form' && !this.noVotes && !this.departed) {
        await this.loadMyVote()
      }

      if (previous && !previous.published && this.voting.published) {
        await this.loadResult()
      }
    },
    review () {
      this.refusal = null
      this.phase = 'confirm'
    },
    change () {
      if (this.refusal && this.refusal.kind === 'network') this.refusal = null
      this.phase = 'form'
    },
    async confirm () {
      const sent = { ...this.counts }
      this.phase = 'sending'

      const ticket = this.startMyVoteRequest()
      try {
        const response = await this.axios.put(this.votingsUrl + '/' + ticket.votingId + '/my-vote', sent)
        this.markDone(ticket.votingId)
        if (!this.isCurrent(ticket)) return
        this.myVote = response.data.data
        this.refusal = null
        this.counts = emptyCounts()
        this.phase = 'form'
        return
      } catch (err) {
        if (!this.isCurrent(ticket)) return
        if (!err.response) {
          this.refusal = NETWORK_REFUSAL
          this.phase = 'confirm'
          return
        }

        if (err.response.status === 403) {
          this.refusal = null
          this.departed = true
          this.phase = 'form'
          return
        }

        if (err.response.status !== 409) {
          const message = err.response.data && err.response.data.message ? err.response.data.message : err.message
          this.refusal = {
            kind: 'error',
            retry: true,
            title: 'Your vote is not saved',
            lines: [message, 'Press "Try again". You can not vote twice: MyAEGEE keeps only the first vote.']
          }
          this.phase = 'confirm'
          return
        }
      }

      await this.handleRefusal(sent)
    },
    // The service refused the vote (409). Read the own votes again and explain from the fresh numbers.
    async handleRefusal (sent) {
      const ticket = this.startMyVoteRequest()
      try {
        const response = await this.axios.get(this.votingsUrl + '/' + ticket.votingId + '/my-vote')
        if (!this.isCurrent(ticket)) return
        this.myVote = response.data.data
      } catch (err) {
        if (!this.isCurrent(ticket)) return
        this.refusal = NETWORK_REFUSAL
        this.phase = 'confirm'
        return
      }

      const outcome = explainRefusal(sent, this.myVote, this.bodyName)
      this.refusal = null
      this.phase = 'form'

      if (outcome.kind === 'recorded' || outcome.kind === 'already_voted') {
        this.alreadyVoted = outcome.kind === 'already_voted'
        this.counts = emptyCounts()
        this.markDone(ticket.votingId)
        return
      }

      if (outcome.kind === 'closed') {
        this.closedWhileVoting = true
        await this.loadVotings()
        await this.pointToNextVoting()
        await this.loadResult()
        return
      }

      this.refusal = outcome
      if (outcome.kept) {
        this.counts = outcome.kept
        this.phase = 'confirm'
      } else {
        this.counts = emptyCounts()
      }
    }
  },
  async mounted () {
    this.isLoading = true

    try {
      const eventResponse = await this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id)
      this.event = eventResponse.data.data

      const [, bodiesResponse] = await Promise.all([
        this.loadVotings(),
        this.axios.get(this.services['core'] + '/bodies/')
      ])
      this.bodies = Object.fromEntries(bodiesResponse.data.data.map((body) => [body.id, body]))

      if (this.$route.query.voting) {
        this.chosenByUser = true
        await this.select(Number(this.$route.query.voting))
      } else if (this.votings.length > 0) {
        await this.select(await this.verifiedChoice(() => this.pickVoting()))
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }
      this.$router.push({ name: 'oms.statutory.list.all' })
    }

    this.isLoading = false
    this.timer = setInterval(this.refresh, REFRESH_MS)
  },
  beforeDestroy () {
    clearInterval(this.timer)
  }
}
</script>

<style lang="scss" src="./votings.scss"></style>
