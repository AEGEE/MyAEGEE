<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <h2 class="modal-card-title">Add plenary</h2>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="plenary-name">Name</label>
        <div class="control">
          <input id="plenary-name" class="input" type="text" required v-model="plenary.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label" for="plenary-starts">Starts</label>
        <div class="control">
          <flat-pickr
            id="plenary-starts"
            placeholder="Select date"
            class="input"
            aria-required="true"
            :config="dateConfig"
            v-model="dates.starts" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="plenary-ends">Ends</label>
        <div class="control">
          <flat-pickr
            id="plenary-ends"
            placeholder="Select date"
            aria-required="true"
            class="input"
            :config="dateConfig"
            v-model="dates.ends" />
        </div>
        <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="savePlenary()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import 'flatpickr/dist/flatpickr.css'
import flatPickr from 'vue-flatpickr-component'

export default {
  name: 'EditPlenaryModal',
  components: {
    flatPickr
  },
  props: ['event', 'plenary', 'services', 'showSuccess', 'showError', 'router'],
  data () {
    return {
      errors: {},
      dateConfig: {
        enableTime: true,
        time_24hr: true,
        // Typed dates are accepted, and phones get the same picker.
        allowInput: true,
        disableMobile: true
      },
      dates: {
        starts: null,
        ends: null
      }
    }
  },
  watch: {
    'dates.starts': function (newDate) {
      this.plenary.starts = new Date(newDate)
    },
    'dates.ends': function (newDate) {
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
        ? this.axios.post(this.services['statutory'] + '/events/' + this.event.id + '/plenaries/', this.plenary)
        : this.axios.put(this.services['statutory'] + '/events/' + this.event.id + '/plenaries/' + this.plenary.id, this.plenary)

      action.then(() => {
        this.showSuccess('Plenary is created.')

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
    this.dates.starts = this.plenary.starts = new Date(this.plenary.starts)
    this.dates.ends = this.plenary.ends = new Date(this.plenary.ends)
  }
}
</script>
