<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title" v-if="isNewIngredient">New ingredient</p>
      <p class="modal-card-title" v-if="!isNewIngredient">Edit Ingredient</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="ingredient.name" />
        </div>
        <p class="help is-danger" v-if="ingredientErrors.name">{{ ingredientErrors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Description</label>
        <div class="control">
          <input class="input" type="text" required v-model="ingredient.description" />
        </div>
        <p class="help is-danger" v-if="ingredientErrors.description">{{ ingredientErrors.description.join(', ')}}</p>
      </div>

      <div class="field has-addons">
        <label class="label">Measurement</label>
        <b-autocomplete
          v-model="addedMeasurementName"
          :data="measurements"
          field="name"
          :loading="isLoadingMeasurements"
          @input="fetchMeasurements"
          expanded="true"
          @select="option => selectMeasurement(option)">

          <template slot-scope="props">
            <div class="media">
              <div class="media-content">{{ props.option.name }}</div>
            </div>
          </template>
        </b-autocomplete>

        <p class="control">
          <a class="button is-danger"
            @click="selectMeasurement(null)"
            v-if="ingredient.default_measurement">{{ ingredient.default_measurement.name }} (Click to unset)</a>
          <a class="button is-static" v-if="!ingredient.default_measurement">Not set.</a>
        </p>

        <p class="help is-danger" v-if="ingredientErrors.default_measurement">{{ ingredientErrors.default_measurement.join(', ')}}</p>
        <p class="help is-danger" v-if="ingredientErrors.default_measurement_id">{{ ingredientErrors.default_measurement_id.join(', ')}}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveIngredient()">Save changes</button>
      <button class="button is-danger" @click="askDeleteIngredient()" v-show="!isNewIngredient">Delete Ingredient</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'IngredientEditModal',
  props: ['ingredient', 'isNewIngredient', 'services', 'showSuccess', 'showDanger', 'reload'],
  data () {
    return {
      ingredientErrors: {},
      addedMeasurementName: '',
      measurements: [],
      token: null,
      isLoadingMeasurements: false
    }
  },
  methods: {
    askDeleteIngredient () {
      this.$buefy.dialog.confirm({
        title: 'Deleting an ingredient',
        message: `Are you sure you want to <b>delete this ingredient</b>?`,
        confirmText: 'Delete ingredient',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteIngredient()
      })
    },
    deleteIngredient () {
      this.axios.delete(this.services['alastair'] + '/ingredients/' + this.ingredient.id).then((response) => {
        this.showSuccess('Ingredient is deleted.')
        this.$parent.close()
        this.reload()
      }).catch((err) => this.showDanger('Could not delete ingredient: ' + err.message))
    },
    selectMeasurement (option) {
      console.log(option)
      this.ingredient.default_measurement = option
      this.ingredient.default_measurement_id = option.id
    },
    fetchMeasurements () {
      this.isLoadingMeasurements = true
      this.measurements = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/measurements', {
        cancelToken: this.token.token,
        params: { query: this.addedMeasurementName, limit: 30 }
      }).then((response) => {
        this.measurements = response.data.data

        this.isLoadingMeasurements = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingMeasurements = false
        this.showDanger('Could not fetch measurements: ' + err.message)
      })
    },
    saveIngredient () {
      this.isLoading = true
      let promise = null
      if (this.isNewIngredient) {
        promise = this.axios.post(this.services['alastair'] + '/ingredients/', { ingredient: this.ingredient })
      } else {
        promise = this.axios.put(this.services['alastair'] + '/ingredients/' + this.ingredient.id, { ingredient: this.ingredient })
      }

      promise.then((response) => {
        this.showSuccess('Ingredient was saved.')

        this.isLoading = false
        this.$parent.close()
        this.reload()
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) this.ingredientErrors = err.response.data.errors

        this.showDanger(message)
      })
    }
  }
}
</script>