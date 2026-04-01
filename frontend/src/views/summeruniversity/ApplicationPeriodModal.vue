<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Set application period</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <form @submit.prevent="saveApplicationPeriod()">
        <div class="field">
          <label class="label">Application starts</label>
          <div class="control">
            <input
              v-model="applicationStarts"
              class="input"
              type="datetime-local">
          </div>
          <p class="help">Leave empty to start immediately.</p>
        </div>

        <div class="field">
          <label class="label">Application ends <span class="has-text-danger">*</span></label>
          <div class="control">
            <input
              v-model="applicationEnds"
              class="input"
              type="datetime-local"
              required>
          </div>
        </div>

        <div class="notification is-info">
          Times are entered in your browser's local timezone
          <span v-if="timezone">({{ timezone }})</span>
          and sent to the backend as exact timestamps.
        </div>

        <div class="field is-grouped is-grouped-right">
          <div class="control">
            <button type="button" class="button" @click="$parent.close()">
              Cancel
            </button>
          </div>
          <div class="control">
            <button type="submit" class="button is-primary" :class="{ 'is-loading': isSaving }" :disabled="isSaving">
              Save
            </button>
          </div>
        </div>
      </form>
    </section>

    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'ApplicationPeriodModal',
  props: ['event', 'services', 'showError', 'showSuccess', 'onUpdated'],
  data () {
    return {
      applicationStarts: this.formatForInput(this.event.application_starts),
      applicationEnds: this.formatForInput(this.event.application_ends),
      isSaving: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  },
  methods: {
    formatForInput (value) {
      if (!value) {
        return ''
      }

      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        return ''
      }

      const timezoneOffset = date.getTimezoneOffset() * 60000
      return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
    },
    saveApplicationPeriod () {
      if (this.applicationStarts && new Date(this.applicationStarts) >= new Date(this.applicationEnds)) {
        this.showError('Application start must be before application end.')
        return
      }

      this.isSaving = true

      const payload = {
        application_ends: new Date(this.applicationEnds).toISOString()
      }

      if (this.applicationStarts) {
        payload.application_starts = new Date(this.applicationStarts).toISOString()
      }

      this.axios.put(this.services['summeruniversity'] + '/single/' + this.event.id + '/application_period', payload).then((response) => {
        this.showSuccess('Event application period was updated.')
        this.onUpdated(response.data.data)
        this.$parent.close()
      }).catch((err) => {
        this.showError('Could not update event application period', err)
      }).finally(() => {
        this.isSaving = false
      })
    }
  }
}
</script>
