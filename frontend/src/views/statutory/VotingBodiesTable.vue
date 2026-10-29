<template>
  <div>
    <div class="tabs voting-filter-tabs" v-if="withProgress">
      <ul>
        <li v-for="tab in tabs" :key="tab.key" :class="{ 'is-active': filter === tab.key }">
          <a @click="filter = tab.key">{{ tab.label }} ({{ tab.count }})</a>
        </li>
      </ul>
    </div>

    <div class="field">
      <input class="input" type="search" name="body-search" v-model="query" placeholder="Search body" aria-label="Search body" />
    </div>

    <b-table class="voting-bodies-table" :data="shownRows" default-sort="name">
      <b-table-column field="name" label="Body" sortable v-slot="props">
        {{ props.row.name }}
      </b-table-column>

      <b-table-column field="votes_total" label="Votes" numeric sortable v-slot="props">
        {{ props.row.votes_total }}
      </b-table-column>

      <b-table-column field="delegates_voted" label="Delegates voted" :visible="withProgress && !withTally" v-slot="props">
        {{ props.row.delegates_voted }} of {{ props.row.delegates_count }}
      </b-table-column>

      <b-table-column field="votes_cast" label="Cast" numeric sortable v-slot="props">
        {{ props.row.votes_cast }}
      </b-table-column>

      <b-table-column field="in_favour" label="For" numeric sortable :visible="withTally" v-slot="props">
        {{ props.row.in_favour }}
      </b-table-column>

      <b-table-column field="against" label="Against" numeric sortable :visible="withTally" v-slot="props">
        {{ props.row.against }}
      </b-table-column>

      <b-table-column field="abstention" label="Abst." numeric sortable :visible="withTally" v-slot="props">
        {{ props.row.abstention }}
      </b-table-column>

      <b-table-column field="status" label="Status" :visible="withProgress" v-slot="props">
        <span class="tag" :class="props.row.status.type">{{ props.row.status.label }}</span>
      </b-table-column>

      <template slot="empty">
        <p class="has-text-grey has-text-centered">No bodies in this list.</p>
      </template>
    </b-table>
  </div>
</template>

<script>
import { bodyProgressStatus } from '../../votings'

// The votes per body of one voting. With progress (for the JC): who voted so far, with filters.
// With tally (after closing): in favour, against and abstention of each body.
export default {
  name: 'VotingBodiesTable',
  props: {
    rows: { type: Array, required: true },
    withProgress: { type: Boolean, default: false },
    withTally: { type: Boolean, default: false }
  },
  data () {
    return {
      filter: this.withTally ? 'all' : 'incomplete',
      query: ''
    }
  },
  computed: {
    rowsWithStatus () {
      return this.rows.map((row) => ({ ...row, status: this.withProgress ? bodyProgressStatus(row) : null }))
    },
    tabs () {
      const incomplete = this.rowsWithStatus.filter((row) => row.status && row.status.key !== 'complete').length
      return [
        { key: 'incomplete', label: 'Incomplete', count: incomplete },
        { key: 'complete', label: 'Complete', count: this.rows.length - incomplete },
        { key: 'all', label: 'All', count: this.rows.length }
      ]
    },
    shownRows () {
      const query = this.query.trim().toLowerCase()
      return this.rowsWithStatus
        .filter((row) => {
          if (!this.withProgress || this.filter === 'all') return true
          return this.filter === 'complete' ? row.status.key === 'complete' : row.status.key !== 'complete'
        })
        .filter((row) => !query || row.name.toLowerCase().includes(query))
    }
  }
}
</script>
