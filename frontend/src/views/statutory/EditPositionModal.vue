<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add position</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>

    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="position.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Application period starts</label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            required
            :config="dateConfig"
            v-model="dates.starts" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Application period ends</label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            :config="dateConfig"
            v-model="dates.ends" />
        </div>
        <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Application period ends (force)</label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            :config="dateConfig"
            v-model="dates.ends_force" />
        </div>
        <p class="help is-danger" v-if="errors.ends_force">{{ errors.ends_force.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Places available</label>
        <div class="control">
        <input type="number" class="input" v-model.number="position.places" min="1">
        </div>
        <p class="help is-danger" v-if="errors.places">{{ errors.places.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Associated body</label>
        <div class="select">
          <select v-model="position.body_id">
            <option v-for="body in bodies" v-bind:key="body.id" :value="body.id">{{ body.name }}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label class="label">Position term starts</label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            required
            :config="dayConfig"
            v-model="dates.start_term" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

      <b-message type="is-info">
        <p>To enter a set date, use the following format:</p>
        <p>yyyy-mm-dd</p>
      </b-message>

      <b-field label="Position term ends" id="term_ends">
          <b-input type="text" required v-model="position.end_term" />
      </b-field>

      <b-message type="is-success" v-if="dateFound">
        A date has been detected
      </b-message>

      <div class="field">
        <label class="label">Requirements for the position</label>
        <div class="control">
          <b-input type="textarea" v-model="position.requirements" />
        </div>
        <label class="label">Preview</label>
        <div class="content">
          <span v-html="$options.filters.markdown(position.requirements)" />
        </div>
      </div>
    </section>

    <footer class="modal-card-foot">
      <button class="button is-primary" @click="savePosition()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'EditPositionModal',
  props: ['event', 'position', 'services', 'showSuccess', 'showError', 'router', 'bodies'],
  data () {
    return {
      errors: {},
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      dayConfig: {
        enableTime: false
      },
      dates: {
        starts: null,
        ends: null,
        ends_force: null,
        start_term: null
      },
      dateFound: null
    }
  },
  watch: {
    'dates.starts': function (newDate) {
      this.position.starts = new Date(newDate)
    },
    'dates.ends': function (newDate) {
      this.position.ends = new Date(newDate)
    },
    'dates.ends_force': function (newDate) {
      this.position.ends_force = new Date(newDate)
    },
    'dates.start_term': function (newDate) {
      this.position.start_term = new Date(newDate)
    },
    'position.end_term': function () {
      this.dateFound = (moment(this.position.end_term, 'YYYY-MM-DD').isValid() && this.position.end_term !== '' && this.position.end_term.length === 10)
    }
  },
  computed: {
    isNew () {
      return !this.position.id
    }
  },
  methods: {
    savePosition () {
      this.isLoading = true

      const action = this.isNew
        ? this.axios.post(this.services['statutory'] + '/events/' + this.event.id + '/positions/', this.position)
        : this.axios.put(this.services['statutory'] + '/events/' + this.event.id + '/positions/' + this.position.id, this.position)

      action.then(() => {
        this.showSuccess('Position is created.')

        this.isLoading = false
        this.router.go(0) // Reloading the page.
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }

        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors
      })
    }
  },
  mounted () {
    this.dates.starts = this.position.starts = new Date(this.position.starts)
    this.dates.ends = this.position.ends = new Date(this.position.ends)
    this.dates.ends_force = this.position.ends_force = new Date(this.position.ends_force)
    this.dates.start_term = this.position.start_term = new Date(this.position.start_term)
  }
}
</script>
