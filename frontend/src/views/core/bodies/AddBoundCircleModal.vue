<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add circle</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="tmpCircle.name" />
        </div>
        <p class="help is-danger" v-if="circleErrors.name">{{ circleErrors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Description</label>
        <div class="control">
          <input class="input" type="text" required v-model="tmpCircle.description" />
        </div>
        <p class="help is-danger" v-if="circleErrors.description">{{ circleErrors.description.join(', ')}}</p>
      </div>

      <!-- <div class="field">
        <label class="label">Joinable?
          <input class="checkbox" type="checkbox" v-model="tmpCircle.joinable" />
        </label>
      </div> -->
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveBoundCircle()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AddBoundCircleModal',
  props: ['body', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      circleErrors: {},
      tmpCircle: {
        name: '',
        description: '',
        joinable: false
      }
    }
  },
  methods: {
    saveBoundCircle () {
      this.isLoading = true
      this.axios.post(this.services['core'] + '/bodies/' + this.body.id + '/circles', {
        name: this.tmpCircle.name,
        description: this.tmpCircle.description
      }).then((response) => {
        this.showSuccess('Bound circle is created.')

        this.tmpCircle = { name: '', description: '', joinable: false }
        this.body.circles.push(response.data.data)

        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }

        if (err.response && err.response.data && err.response.data.errors) this.circleErrors = err.response.data.errors
      })
    }
  }
}
</script>
