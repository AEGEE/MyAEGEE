<template>
  <div class="voting-result" :class="accepted ? 'is-accepted' : 'is-rejected'">
    <div class="verdict">{{ accepted ? 'Accepted' : 'Rejected' }}</div>
    <div class="has-text-grey is-size-7">{{ majorityName }}. {{ majority.rule }}</div>

    <div class="voting-tally">
      <div class="voting-stat" v-for="choice in choices" :key="choice.field">
        <div class="voting-stat-number">{{ result[choice.field] }} <small>{{ result[choice.field + '_percentage'] }}%</small></div>
        <div class="voting-stat-label">{{ choice.label }}</div>
      </div>
    </div>

    <div class="voting-split-bar" aria-hidden="true">
      <span class="is-in-favour" :style="{ width: share('in_favour') }" />
      <span class="is-against" :style="{ width: share('against') }" />
      <span class="is-abstention" :style="{ width: share('abstention') }" />
    </div>

    <p class="details">
      {{ majority.calculation }}.
      Votes cast: {{ result.votes_cast }} of {{ result.votes_total }}.
      Bodies present: {{ result.bodies_present }} of {{ result.bodies_available }}.
      Closed at {{ result.voting.closed_at | datetime }}.
    </p>
  </div>
</template>

<script>
import { CHOICES, MAJORITY_NAMES, explainMajority, totalVotes } from '../../votings'

// The result of a closed voting (GET /events/:id/votings/:voting_id/result):
// accepted or rejected, the three totals, and the calculation behind it.
export default {
  name: 'VotingResult',
  props: ['result'],
  data () {
    return {
      choices: CHOICES
    }
  },
  computed: {
    accepted () {
      return this.result.result === 'accepted'
    },
    majorityName () {
      return MAJORITY_NAMES[this.result.majority]
    },
    majority () {
      return explainMajority(this.result.majority, this.result)
    }
  },
  methods: {
    share (field) {
      const total = totalVotes(this.result)
      return total ? (100 * this.result[field] / total) + '%' : '0%'
    }
  }
}
</script>

<style lang="scss" src="./votings.scss"></style>
