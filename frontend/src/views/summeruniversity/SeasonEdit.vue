<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <form @submit.prevent="saveSeason()">
        <div class="field">
          <label class="label" for="season-year">Year <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="season-year" class="input" type="number" required :disabled="!!$route.params.year" v-model.number="season.year" />
          </div>
          <p class="help" v-if="$route.params.year">The year can't be changed, as events refer to the season by its year.</p>
          <p class="help is-danger" v-if="errors.year">{{ errors.year.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="season-name">Name <span class="has-text-danger">*</span></label>
          <div class="control">
            <input id="season-name" class="input" type="text" required v-model="season.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="season-event-submission-deadline">Event submission deadline</label>
          <div class="control">
            <input id="season-event-submission-deadline" class="input" type="datetime-local" v-model="dates.event_submission_deadline" />
          </div>
          <p class="help is-danger" v-if="errors.event_submission_deadline">{{ errors.event_submission_deadline.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="season-application-period-starts">Application period starts</label>
          <div class="control">
            <input id="season-application-period-starts" class="input" type="datetime-local" v-model="dates.application_period_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_starts">{{ errors.application_period_starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="season-application-period-ends">Application period ends</label>
          <div class="control">
            <input id="season-application-period-ends" class="input" type="datetime-local" v-model="dates.application_period_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_period_ends">{{ errors.application_period_ends.join(', ') }}</p>
        </div>

        <timezone-notification />

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save season" :disabled="isSaving" class="button is-primary" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'

const DATE_FIELDS = ['event_submission_deadline', 'application_period_starts', 'application_period_ends']

export default {
  name: 'SummerUniversitySeasonEdit',
  components: {
    TimezoneNotification
  },
  data () {
    return {
      season: {
        year: null,
        name: ''
      },
      dates: {
        event_submission_deadline: '',
        application_period_starts: '',
        application_period_ends: ''
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    // Converts a timestamp to the browser's local time for a datetime-local input.
    formatForInput (value) {
      if (!value) {
        return ''
      }

      const date = new Date(value)
      const timezoneOffset = date.getTimezoneOffset() * 60000
      return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
    },
    saveSeason () {
      this.isSaving = true
      this.errors = {}

      const payload = { year: this.season.year, name: this.season.name }
      for (const field of DATE_FIELDS) {
        payload[field] = this.dates[field] ? new Date(this.dates[field]).toISOString() : null
      }

      const promise = this.$route.params.year
        ? this.axios.put(this.services['summeruniversity'] + '/seasons/' + this.$route.params.year, payload)
        : this.axios.post(this.services['summeruniversity'] + '/seasons', payload)

      promise.then(() => {
        this.isSaving = false
        this.$root.showSuccess('Season is saved.')
        return this.$router.push({ name: 'oms.summeruniversity.seasons' })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) {
          this.errors = err.response.data.errors || {}
          return this.$root.showError('Some of the season data is invalid.')
        }

        this.$root.showError('Could not save season', err)
      })
    }
  },
  mounted () {
    if (!this.$route.params.year) {
      return // if creating a new season
    }

    this.isLoading = true
    this.axios.get(this.services['summeruniversity'] + '/seasons').then((response) => {
      const season = response.data.data.find((s) => s.year === Number(this.$route.params.year))
      if (!season) {
        this.isLoading = false
        this.$root.showError('Season is not found')
        return this.$router.push({ name: 'oms.summeruniversity.seasons' })
      }

      this.season = season
      for (const field of DATE_FIELDS) {
        this.dates[field] = this.formatForInput(season[field])
      }
      this.isLoading = false
    }).catch((err) => {
      this.$root.showError('Could not fetch season', err)
      this.$router.push({ name: 'oms.summeruniversity.seasons' })
    })
  }
}
</script>
