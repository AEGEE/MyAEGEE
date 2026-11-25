<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add circle</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="bound-circle-name">Name</label>
        <div class="control">
          <input id="bound-circle-name" class="input" type="text" required v-model="tmpCircle.name" />
        </div>
        <p class="help is-danger" v-if="circleErrors.name">{{ circleErrors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label" for="bound-circle-description">Description</label>
        <div class="control">
          <input id="bound-circle-description" class="input" type="text" required v-model="tmpCircle.description" />
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
      <button type="button" class="button is-primary" :class="{ 'is-loading': isLoading }" :disabled="isLoading" @click="saveBoundCircle()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
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
      isLoading: false,
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
