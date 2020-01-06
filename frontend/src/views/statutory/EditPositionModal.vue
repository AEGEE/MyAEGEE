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
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="savePosition()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditPositionModal',
  props: ['event', 'position', 'services', 'showSuccess', 'showError', 'router'],
  data () {
    return {
      errors: {},
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      dates: {
        starts: null,
        ends: null,
        ends_force: null
      }
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
        ? this.axios.post(this.services['oms-statutory'] + '/events/' + this.event.id + '/positions/', this.position)
        : this.axios.put(this.services['oms-statutory'] + '/events/' + this.event.id + '/positions/' + this.position.id, this.position)

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
  }
}
</script>
