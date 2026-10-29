<template>
  <div class="voting-page">
    <!-- On a phone the agenda is a picker above the details. -->
    <div class="voting-picker is-hidden-tablet mb-4" v-if="votings.length > 0">
      <button class="voting-picker-button" :aria-expanded="pickerOpen ? 'true' : 'false'" @click="pickerOpen = !pickerOpen">
        <span class="has-text-grey is-size-7">Voting {{ selectedIndex + 1 }} of {{ votings.length }} in this Agora</span>
        <span class="voting-picker-title">{{ voting ? voting.title : '' }}</span>
      </button>
      <div class="voting-list mt-2" v-if="pickerOpen">
        <button v-for="item in votings" :key="item.id" :class="{ 'is-selected': item.id === selectedId }" @click="select(item.id)">
          <span class="tags">
            <span class="tag" :class="statusOf(item).type">{{ statusOf(item).label }}</span>
            <span class="tag" :class="resultOf(item).type" v-if="resultOf(item)">{{ resultOf(item).label }}</span>
            <span class="tag">{{ kindNames[item.kind] }}</span>
          </span>
          <span class="voting-list-title">{{ item.title }}</span>
        </button>
      </div>
    </div>
    <button class="button is-primary is-outlined is-fullwidth mb-4 is-hidden-tablet" v-if="votings.length > 0" @click="openEditModal(null)">New voting</button>

    <div class="voting-jc-columns">
      <div class="voting-list is-hidden-mobile">
        <h2 class="title is-6 mb-2">Votings in this Agora</h2>
        <button v-for="item in votings" :key="item.id" :class="{ 'is-selected': item.id === selectedId }" @click="select(item.id)">
          <span class="tags">
            <span class="tag" :class="statusOf(item).type">{{ statusOf(item).label }}</span>
            <span class="tag" :class="resultOf(item).type" v-if="resultOf(item)">{{ resultOf(item).label }}</span>
            <span class="tag">{{ kindNames[item.kind] }}</span>
          </span>
          <span class="voting-list-title">{{ item.title }}</span>
          <span class="has-text-grey is-size-7">{{ majorityNames[item.majority] }}</span>
        </button>
        <button class="button is-primary is-outlined is-fullwidth mt-2" @click="openEditModal(null)">New voting</button>
      </div>

      <div v-if="!voting && !isLoading">
        <h1 class="title is-4 mb-2">No votings yet</h1>
        <p class="mb-4">Create the first voting of {{ event.name }}. It opens and closes by itself at the times you set.</p>
        <button class="button is-primary is-hidden-tablet" @click="openEditModal(null)">New voting</button>
      </div>

      <div v-if="voting">
        <div class="voting-detail-head mb-4">
          <div>
            <div class="tags mb-2">
              <span class="tag" :class="status.type">{{ status.label }}</span>
              <span class="tag" :class="result.type" v-if="result">{{ result.label }}</span>
              <span class="tag">{{ kindNames[voting.kind] }}</span>
              <span class="tag">{{ majorityNames[voting.majority] }}</span>
              <span class="voting-live" v-if="voting.status === 'open'">Live</span>
            </div>
            <h1 class="title is-4 mb-1">{{ voting.title }}</h1>
            <p class="has-text-grey is-size-7">{{ timeLine }}</p>
          </div>
          <div class="buttons" v-if="voting.status === 'scheduled'">
            <button class="button is-light" @click="openEditModal(voting)">Edit</button>
            <button class="button is-danger is-light" @click="askDelete()">Delete</button>
          </div>
          <div class="buttons" v-if="voting.status === 'closed' && !voting.published">
            <button class="button is-primary" :class="{ 'is-loading': isPublishing }" @click="askPublish()">Publish result</button>
          </div>
        </div>

        <div class="content mb-4" v-if="voting.description" v-html="$options.filters.markdown(voting.description)" />

        <div class="notification is-info is-light" v-if="voting.status === 'scheduled'">
          <div class="voting-notification-head"><font-awesome-icon icon="info-circle" /><span>When this voting opens</span></div>
          <p>
            At {{ voting.opens_at | datetime }} MyAEGEE takes a snapshot of who can vote: every delegate who is confirmed,
            registered, not departed and not cancelled, with the votes of their body.
            Delegates who arrive or depart after that moment do not change it.
          </p>
        </div>

        <template v-if="voting.status === 'open' && progress">
          <div class="voting-stats mb-2">
            <div class="voting-stat"><div class="voting-stat-number">{{ progress.votes_total }}</div><div class="voting-stat-label">Total available votes</div></div>
            <div class="voting-stat"><div class="voting-stat-number">{{ progress.votes_cast }}</div><div class="voting-stat-label">Votes cast</div></div>
            <div class="voting-stat"><div class="voting-stat-number">{{ progress.votes_cast_percentage }}%</div><div class="voting-stat-label">Of the available votes</div></div>
          </div>
          <div
            class="voting-progress"
            role="progressbar"
            aria-label="Votes cast"
            :aria-valuenow="Math.round(progress.votes_cast_percentage)"
            aria-valuemin="0"
            aria-valuemax="100">
            <span :style="{ width: progress.votes_cast_percentage + '%' }" />
          </div>
          <p class="has-text-grey is-size-7 mt-2">
            Bodies complete: {{ bodiesComplete }} of {{ progress.bodies_available }}.
            Delegates voted: {{ delegatesVoted }} of {{ delegatesCount }}.
            Nobody sees in favour, against or abstention before the voting closes.
          </p>
          <h2 class="title is-6 mt-5 mb-2">Votes per body</h2>
          <voting-bodies-table :rows="progressRows" with-progress />
        </template>

        <template v-if="voting.status === 'closed' && resultData && progress">
          <div class="notification is-warning is-light" v-if="!voting.published">
            Only the Juridical Commission sees this result now.
            After you publish it, every logged-in user sees the totals and the votes of each body.
          </div>
          <voting-result :result="resultData" />
          <h2 class="title is-6 mt-5 mb-2">Votes per body</h2>
          <voting-bodies-table :rows="closedRows" with-progress with-tally />
        </template>
      </div>
    </div>

    <b-loading :is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import moment from 'moment'
import { mapGetters } from 'vuex'
import EditVotingModal from './EditVotingModal.vue'
import VotingResult from './VotingResult.vue'
import VotingBodiesTable from './VotingBodiesTable.vue'
import { KIND_NAMES, MAJORITY_NAMES, bodyProgressStatus, resultTag, statusTag } from '../../votings'

// How often the page asks for the votings and the progress of an open voting.
const REFRESH_MS = 5000

const format = (time) => moment(time).format('YYYY-MM-DD HH:mm')

// The Juridical Commission manages the votings of an Agora here: all votings on the left,
// the chosen one on the right. A voting opens and closes by itself at its times; while it is open,
// the JC sees how many votes are cast and who voted, but not what they voted.
// After it closes, the JC sees the result and publishes it.
export default {
  name: 'StatutoryVotings',
  components: { VotingResult, VotingBodiesTable },
  data () {
    return {
      kindNames: KIND_NAMES,
      majorityNames: MAJORITY_NAMES,
      event: { id: null, name: '' },
      votings: [],
      bodies: {},
      selectedId: null,
      progress: null,
      resultData: null,
      pickerOpen: false,
      isLoading: false,
      isPublishing: false,
      timer: null
    }
  },
  computed: {
    ...mapGetters(['services']),
    voting () {
      return this.votings.find((voting) => voting.id === this.selectedId) || null
    },
    selectedIndex () {
      return this.votings.findIndex((voting) => voting.id === this.selectedId)
    },
    status () {
      return statusTag(this.voting)
    },
    result () {
      return resultTag(this.voting)
    },
    timeLine () {
      const voting = this.voting
      if (voting.status === 'scheduled') {
        return `Opens automatically at ${format(voting.opens_at)}. Closes automatically at ${format(voting.closes_at)}.`
      }
      if (voting.status === 'open') {
        return `Opened at ${format(voting.opened_at)}. Closes automatically at ${format(voting.closes_at)}.`
      }
      const published = voting.published ? ` Published at ${format(voting.published_at)}.` : ''
      return `Opened at ${format(voting.opened_at)}, closed at ${format(voting.closed_at)}.${published}`
    },
    progressRows () {
      return this.progress.bodies.map((body) => ({ ...body, name: this.bodyNameOf(body.body_id) }))
    },
    closedRows () {
      return this.progressRows.map((body) => {
        const tally = this.resultData.bodies.find((row) => row.body_id === body.body_id)
        return { ...body, in_favour: 0, against: 0, abstention: 0, ...tally }
      })
    },
    bodiesComplete () {
      return this.progress.bodies.filter((body) => bodyProgressStatus(body).key === 'complete').length
    },
    delegatesVoted () {
      return this.progress.bodies.reduce((sum, body) => sum + body.delegates_voted, 0)
    },
    delegatesCount () {
      return this.progress.bodies.reduce((sum, body) => sum + body.delegates_count, 0)
    },
    votingsUrl () {
      return this.services['statutory'] + '/events/' + this.event.id + '/votings'
    }
  },
  methods: {
    statusOf (voting) {
      return statusTag(voting)
    },
    resultOf (voting) {
      return resultTag(voting)
    },
    bodyNameOf (bodyId) {
      return this.bodies[bodyId] ? this.bodies[bodyId].name : 'Body ' + bodyId
    },
    // The voting to show first: the first open one, else the next scheduled one, else the last one.
    pickVoting () {
      const open = this.votings.find((voting) => voting.status === 'open')
      const scheduled = this.votings.find((voting) => voting.status === 'scheduled')
      const chosen = open || scheduled || this.votings[this.votings.length - 1]
      return chosen ? chosen.id : null
    },
    async select (votingId) {
      this.pickerOpen = false
      if (votingId === this.selectedId) return

      this.selectedId = votingId
      this.progress = null
      this.resultData = null
      await this.loadDetails()
    },
    async loadVotings () {
      const response = await this.axios.get(this.votingsUrl)
      this.votings = response.data.data
    },
    async loadDetails () {
      const voting = this.voting
      if (!voting || voting.status === 'scheduled') return

      const requests = [this.axios.get(this.votingsUrl + '/' + voting.id + '/progress')]
      if (voting.status === 'closed') {
        requests.push(this.axios.get(this.votingsUrl + '/' + voting.id + '/result'))
      }

      try {
        const [progress, result] = await Promise.all(requests)
        if (this.selectedId !== voting.id) return

        this.progress = progress.data.data
        this.resultData = result ? result.data.data : null
      } catch (err) {
        if (err.response) this.$root.showError('Could not load the voting', err)
      }
    },
    // Runs every few seconds: votings open and close by themselves, and votes come in.
    async refresh () {
      const previous = this.voting ? this.voting.status : null

      try {
        await this.loadVotings()
      } catch (err) {
        return
      }

      if (!this.voting) {
        this.selectedId = null
        await this.select(this.pickVoting())
        return
      }

      if (this.voting.status === 'open' || previous !== this.voting.status) {
        await this.loadDetails()
      }
    },
    openEditModal (voting) {
      this.$buefy.modal.open({
        parent: this,
        component: EditVotingModal,
        hasModalCard: true,
        trapFocus: true,
        props: {
          event: this.event,
          voting,
          services: this.services
        },
        events: {
          saved: async (saved) => {
            this.$root.showSuccess(voting ? 'Voting is saved.' : 'Voting is created.')
            await this.loadVotings()
            this.selectedId = null
            await this.select(saved.id)
          }
        }
      })
    },
    askDelete () {
      const voting = this.voting
      this.$buefy.dialog.confirm({
        title: 'Delete voting',
        message: 'Are you sure you want to delete this voting? It did not open yet, so nobody voted.',
        confirmText: 'Delete voting',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteVoting(voting)
      })
    },
    deleteVoting (voting) {
      this.axios.delete(this.votingsUrl + '/' + voting.id).then(async () => {
        this.$root.showSuccess('Voting is deleted.')
        await this.loadVotings()
        this.selectedId = null
        await this.select(this.pickVoting())
      }).catch((err) => {
        this.$root.showError('Could not delete the voting', err)
        this.refresh()
      })
    },
    askPublish () {
      this.$buefy.dialog.confirm({
        title: 'Publish the result',
        message: 'After you publish, every logged-in user sees the totals and the votes of each body. You can not undo this.',
        confirmText: 'Publish result',
        type: 'is-primary',
        hasIcon: true,
        onConfirm: () => this.publish()
      })
    },
    publish () {
      const voting = this.voting
      this.isPublishing = true
      this.axios.put(this.votingsUrl + '/' + voting.id + '/publish').then(async () => {
        this.isPublishing = false
        this.$root.showSuccess('The result is published.')
        await this.loadVotings()
      }).catch((err) => {
        this.isPublishing = false
        this.$root.showError('Could not publish the result', err)
      })
    }
  },
  async mounted () {
    this.isLoading = true

    try {
      const eventResponse = await this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id)
      this.event = eventResponse.data.data

      if (!this.event.permissions.manage_votings) {
        this.$root.showError('You cannot manage votings for this event.')
        this.$router.push({ name: 'oms.statutory.view', params: { id: this.$route.params.id } })
        return
      }

      const [, bodiesResponse] = await Promise.all([
        this.loadVotings(),
        this.axios.get(this.services['core'] + '/bodies/')
      ])
      this.bodies = Object.fromEntries(bodiesResponse.data.data.map((body) => [body.id, body]))
      await this.select(this.pickVoting())
    } catch (err) {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }
      this.$router.push({ name: 'oms.statutory.list.all' })
    } finally {
      this.isLoading = false
    }

    this.timer = setInterval(this.refresh, REFRESH_MS)
  },
  beforeDestroy () {
    clearInterval(this.timer)
  }
}
</script>

<style lang="scss" src="./votings.scss"></style>
