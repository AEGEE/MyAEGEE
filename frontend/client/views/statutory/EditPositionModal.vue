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
        <label class="label">Places available</label>
        <div class="control">
        <input type="number" class="input" v-model.number="position.places" min="1">
        </div>
        <p class="help is-danger" v-if="errors.places">{{ errors.places.join(', ') }}</p>
      </div>

      <!-- <div class="field">
        <label class="label">Joinable?
          <input class="checkbox" type="checkbox" v-model="tmpCircle.joinable" />
        </label>
      </div> -->
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
  props: ['event', 'position', 'services', 'showSuccess', 'showDanger', 'router'],
  data () {
    return {
      errors: {},
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      dates: {
        starts: null,
        ends: null
      }
    }
  },
  watch: {
    'dates.starts' (newDate) {
      this.position.starts = new Date(newDate)
    },
    'dates.ends' (newDate) {
      this.position.ends = new Date(newDate)
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

      action.then((response) => {
        this.showSuccess('Position is created.')

        this.isLoading = false
        this.router.go(0) // Reloading the page.
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors

        this.showDanger(message)
      })
    }
  },
  mounted () {
    this.dates.starts = this.position.starts = new Date(this.position.starts)
    this.dates.ends = this.position.ends = new Date(this.position.ends)
  }
}
</script>