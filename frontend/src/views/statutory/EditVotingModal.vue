<template>
  <div class="modal-card voting-modal">
    <header class="modal-card-head">
      <p class="modal-card-title">{{ isNew ? 'New voting' : 'Edit voting' }}</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="notification is-danger is-light" role="alert" v-if="refusal">{{ refusal }}</div>

      <div class="field">
        <span class="label">Type</span>
        <label class="radio">
          <input type="radio" name="voting-kind" value="proposal" v-model="form.kind" />
          Proposal
        </label>
        <label class="radio">
          <input type="radio" name="voting-kind" value="rollcall" v-model="form.kind" />
          Roll call
        </label>
        <p class="help is-danger" v-if="errors.kind">{{ errors.kind.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="voting-title">Title</label>
        <input class="input" id="voting-title" type="text" v-model="form.title" placeholder="Proposal 7: Agora hosting criteria" />
        <p class="help is-danger" v-if="errors.title">{{ errors.title.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="voting-description">Description <span class="has-text-grey has-text-weight-normal">(optional)</span></label>
        <textarea class="textarea" id="voting-description" rows="2" v-model="form.description" />
        <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="voting-majority">Majority</label>
        <div class="select is-fullwidth">
          <select id="voting-majority" v-model="form.majority">
            <option v-for="(name, key) in majorityNames" :key="key" :value="key">{{ name }}</option>
          </select>
        </div>
        <p class="help is-danger" v-if="errors.majority">{{ errors.majority.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="voting-opens">Voting opens</label>
        <input class="input" id="voting-opens" type="datetime-local" v-model="form.opens_at" />
        <p class="help is-danger" v-if="errors.opens_at">{{ errors.opens_at.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="voting-closes">Voting closes</label>
        <input class="input" id="voting-closes" type="datetime-local" v-model="form.closes_at" />
        <p class="help is-danger" v-if="errors.closes_at">{{ errors.closes_at.join(', ') }}</p>
      </div>

      <p class="has-text-grey is-size-7">
        Times are in your local time ({{ timezone }}).
        The voting opens and closes by itself at these times.
        You can change it until it opens.
      </p>
    </section>
    <footer class="modal-card-foot">
      <button class="button" @click="$parent.close()">Cancel</button>
      <button class="button is-primary" :class="{ 'is-loading': isSaving }" @click="save()">Save</button>
    </footer>
  </div>
</template>

<script>
import moment from 'moment'
import { MAJORITY_NAMES } from '../../votings'

const INPUT_FORMAT = 'YYYY-MM-DDTHH:mm'

// Creates a voting, or edits one that did not open yet. Every voting has a fixed time window:
// the statutory service opens and closes it by itself, there is no button to open or close.
export default {
  name: 'EditVotingModal',
  props: ['event', 'voting', 'services'],
  data () {
    const voting = this.voting || {}
    return {
      majorityNames: MAJORITY_NAMES,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      form: {
        kind: voting.kind || 'proposal',
        title: voting.title || '',
        description: voting.description || '',
        majority: voting.majority || 'simple',
        opens_at: voting.opens_at ? moment(voting.opens_at).format(INPUT_FORMAT) : '',
        closes_at: voting.closes_at ? moment(voting.closes_at).format(INPUT_FORMAT) : ''
      },
      errors: {},
      refusal: null,
      isSaving: false
    }
  },
  computed: {
    isNew () {
      return !this.voting
    }
  },
  methods: {
    validate () {
      const errors = {}
      if (!this.form.title.trim()) errors.title = ['Voting title should be set.']
      if (!this.form.opens_at) errors.opens_at = ['The time when the voting opens should be set.']
      if (!this.form.closes_at) errors.closes_at = ['The time when the voting closes should be set.']
      if (this.form.opens_at && this.form.closes_at && !moment(this.form.closes_at).isAfter(this.form.opens_at)) {
        errors.closes_at = ['A voting should close after it opens.']
      }
      return errors
    },
    save () {
      this.refusal = null
      this.errors = this.validate()
      if (Object.keys(this.errors).length > 0) {
        return
      }

      const body = {
        ...this.form,
        title: this.form.title.trim(),
        description: this.form.description.trim() || null,
        // The input has no time zone: it is the local time of the browser.
        opens_at: moment(this.form.opens_at, INPUT_FORMAT).toISOString(),
        closes_at: moment(this.form.closes_at, INPUT_FORMAT).toISOString()
      }
      const url = this.services['statutory'] + '/events/' + this.event.id + '/votings'

      this.isSaving = true
      const request = this.isNew
        ? this.axios.post(url, body)
        : this.axios.put(url + '/' + this.voting.id, body)

      request.then((response) => {
        this.isSaving = false
        this.$emit('saved', response.data.data)
        this.$parent.close()
      }).catch((err) => {
        this.isSaving = false
        const data = err.response && err.response.data
        if (data && data.errors) {
          this.errors = data.errors
        } else if (data && data.message) {
          this.refusal = data.message
        } else {
          this.refusal = 'The voting is not saved: there is no connection to MyAEGEE. Try again.'
        }
      })
    }
  }
}
</script>
