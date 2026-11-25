<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Summer University seasons</h4>

        <div class="field">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.summeruniversity.seasons.create' }">Create season</router-link>
          </div>
        </div>

        <b-table :data="seasons" :loading="isLoading" narrowed>
          <b-table-column field="year" label="Year" v-slot="props">
            {{ props.row.year }}
          </b-table-column>

          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column field="event_submission_deadline" label="Event submission deadline" v-slot="props">
            <span v-if="props.row.event_submission_deadline">{{ props.row.event_submission_deadline | datetime }}</span>
            <span v-else>-</span>
          </b-table-column>

          <b-table-column label="Application period" v-slot="props">
            <span v-if="props.row.application_period_starts">{{ props.row.application_period_starts | datetime }}</span>
            <span v-else>-</span>
            to
            <span v-if="props.row.application_period_ends">{{ props.row.application_period_ends | datetime }}</span>
            <span v-else>-</span>
          </b-table-column>

          <b-table-column field="active" label="Active" v-slot="props">
            <span v-if="props.row.active" class="tag is-success">Active</span>
            <button v-else @click="askSetActive(props.row)" class="button is-small is-info">Set active</button>
          </b-table-column>

          <b-table-column label="Edit" v-slot="props">
            <router-link :to="{ name: 'oms.summeruniversity.seasons.edit', params: { year: props.row.year } }" class="button is-small is-warning">Edit</router-link>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SummerUniversitySeasons',
  data () {
    return {
      // Set once the member left the page: what arrives after that is not shown.
      left: false,
      seasons: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    askSetActive (season) {
      this.$buefy.dialog.confirm({
        title: 'Set the active season',
        message: 'Are you sure you want to make this season the active one? New events will be created in this season.',
        confirmText: 'Set active',
        type: 'is-info',
        hasIcon: true,
        onConfirm: () => this.setActive(season)
      })
    },
    setActive (season) {
      this.axios.put(this.services['summeruniversity'] + '/seasons/' + season.year + '/active').then(() => {
        this.$root.showSuccess('The active season is changed.')
        for (const other of this.seasons) {
          other.active = other.year === season.year
        }
      }).catch((err) => this.$root.showError('Could not set the active season', err))
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['summeruniversity'] + '/seasons').then((response) => {
        this.seasons = response.data.data
        this.isLoading = false
      }).catch((err) => {
        if (this.left) return

        this.isLoading = false
        this.$root.showError('Could not fetch seasons', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  },
  beforeDestroy () {
    this.left = true
  }
}
</script>
