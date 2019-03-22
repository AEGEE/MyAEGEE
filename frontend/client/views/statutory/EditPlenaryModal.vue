<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add plenary</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="plenary.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Starts</label>
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
        <label class="label">Ends</label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            :config="dateConfig"
            v-model="dates.ends" />
        </div>
        <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="savePlenary()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditPlenaryModal',
  props: ['event', 'plenary', 'services', 'showSuccess', 'showDanger', 'router'],
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
      this.plenary.starts = new Date(newDate)
    },
    'dates.ends' (newDate) {
      this.plenary.ends = new Date(newDate)
    }
  },
  computed: {
    isNew () {
      return !this.plenary.id
    }
  },
  methods: {
    savePlenary () {
      this.isLoading = true

      const action = this.isNew
        ? this.axios.post(this.services['oms-statutory'] + '/events/' + this.event.id + '/plenaries/', this.plenary)
        : this.axios.put(this.services['oms-statutory'] + '/events/' + this.event.id + '/plenaries/' + this.plenary.id, this.plenary)

      action.then((response) => {
        this.showSuccess('Plenary is created.')

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
    this.dates.starts = this.plenary.starts = new Date(this.plenary.starts)
    this.dates.ends = this.plenary.ends = new Date(this.plenary.ends)
  }
}
</script>