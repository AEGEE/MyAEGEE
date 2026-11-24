<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <h2 class="modal-card-title">Add position</h2>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="statutory-position-name">Name</label>
        <div class="control">
          <input id="statutory-position-name" class="input" type="text" required v-model="position.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label" for="statutory-position-starts">Application period starts</label>
        <div class="control">
          <flat-pickr
            id="statutory-position-starts"
            placeholder="Select date"
            class="input"
            required
            :config="dateConfig"
            v-model="dates.starts" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="statutory-position-ends">Application period ends</label>
        <div class="control">
          <flat-pickr
            id="statutory-position-ends"
            placeholder="Select date"
            class="input"
            :config="dateConfig"
            v-model="dates.ends" />
        </div>
        <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="statutory-position-places">Places available</label>
        <div class="control">
          <input id="statutory-position-places" type="number" class="input" v-model.number="position.places" min="1">
        </div>
        <p class="help is-danger" v-if="errors.places">{{ errors.places.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="statutory-position-body">Associated body</label>
        <div class="select">
          <select id="statutory-position-body" v-model="position.body_id">
            <option v-for="body in bodies" v-bind:key="body.id" :value="body.id">{{ body.name }}</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label class="label" for="statutory-position-start-term">Position term starts</label>
        <div class="control">
          <flat-pickr
            id="statutory-position-start-term"
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

      <b-field label="Position term ends" label-for="statutory-position-end-term">
        <b-input id="statutory-position-end-term" type="text" required v-model="position.end_term" />
      </b-field>

      <b-message type="is-success" v-if="dateFound">
        A date has been detected
      </b-message>

      <div class="field">
        <label class="label" for="statutory-position-requirements">Requirements for the position</label>
        <div class="control">
          <b-input id="statutory-position-requirements" type="textarea" v-model="position.requirements" />
        </div>
        <p class="label">Preview <MarkdownTooltip /></p>
        <div class="content">
          <span v-html="$options.filters.markdown(position.requirements)" />
        </div>
      </div>
    </section>

    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="savePosition()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import 'flatpickr/dist/flatpickr.css'
import flatPickr from 'vue-flatpickr-component'
import moment from 'moment'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    flatPickr,
    MarkdownTooltip
  },
  name: 'EditPositionModal',
  props: ['event', 'position', 'services', 'showSuccess', 'showError', 'router', 'bodies'],
  data () {
    return {
      errors: {},
      // Typed dates are accepted, and phones get the same picker.
      dateConfig: {
        enableTime: true,
        time_24hr: true,
        allowInput: true,
        disableMobile: true
      },
      dayConfig: {
        enableTime: false,
        allowInput: true,
        disableMobile: true
      },
      dates: {
        starts: null,
        ends: null,
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
    this.dates.start_term = this.position.start_term = new Date(this.position.start_term)
  }
}
</script>
