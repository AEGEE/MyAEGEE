<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title" v-if="isNewMeal">New meal</p>
      <p class="modal-card-title" v-if="!isNewMeal">Edit Meal</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="meal.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Date</label>
        <div class="control">
          <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="meal.date" />        </div>
        <p class="help is-danger" v-if="errors.date">{{ errors.date.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Time</label>
        <div class="control">
          <flat-pickr
              placeholder="Select time"
              class="input"
              required
              :config="timeConfig"
              v-model="meal.time" />        </div>
        <p class="help is-danger" v-if="errors.time">{{ errors.time.join(', ')}}</p>
      </div>

      <hr />

      <p>You can add as many recipes to a meal as you wish</p>

      <table class="table is-fullwidth is-narrowed">
        <thead>
          <tr>
            <th>Recipe</th>
            <th>Person count</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(mr, index) in meal.meals_recipes">
            <td>{{ mr.recipe.name }}</td>
            <td>
               <div class="field">
                <div class="control">
                  <input class="input" type="number" v-model="mr.person_count" min="0" step="1" required />
                </div>
              </div>

              <p class="help is-danger" v-if="errors.meals_recipes && errors.meals_recipes[index] && errors.meals_recipes[index] !== {}">
                <span v-for="(value, key) in errors.meals_recipes[index]">
                  Error in {{ key }}: {{ value.join(', ') }}
                </span>
              </p>
            </td>
            <td>
              <button type="button" class="btn btn-warn" v-on:click="removeRecipe(index)"><i class="fa-minus"></i> Del</button>
            </td>
          </tr>
          <tr>
            <td colspan="3">
            <label>Add a recipe</label>
             <b-autocomplete
              v-model="addedRecipeName"
              :data="recipes"
              field="name"
              :loading="isLoadingRecipes"
              @input="fetchRecipes"
              expanded="true"
              @select="option => selectRecipe(option)">

                <template slot-scope="props">
                  <div class="media">
                    <div class="media-content">{{ props.option.name }}</div>
                  </div>
                </template>
              </b-autocomplete>
            </td>
          </tr>
        </tbody>
      </table>

      <div style="height: 100px"></div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveMeal()">Save changes</button>
      <button class="button is-danger" @click="askDeleteMeal()" v-show="!isNewMeal">Delete Meal</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditMealModal',
  props: ['event', 'meal', 'isNewMeal', 'services', 'showSuccess', 'showDanger', 'reload'],
  data () {
    return {
      errors: {},
      addedRecipeName: '',
      recipes: [],
      token: null,
      isLoadingRecipes: false,
      dateConfig: {
        enableTime: false
      },
      timeConfig: {
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i:S',
        time_24hr: true
      }
    }
  },
  methods: {
    askDeleteMeal () {
      this.$dialog.confirm({
        title: 'Deleting a meal',
        message: `Are you sure you want to <b>delete this meal</b>?`,
        confirmText: 'Delete meal',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteMeal()
      })
    },
    deleteMeal () {
      this.axios.delete(this.services['alastair'] + '/events/' + this.event.id + '/meals/' + this.meal.id).then((response) => {
        this.showSuccess('Meal is deleted.')
        this.$parent.close()
        this.reload()
      }).catch((err) => this.showDanger('Could not delete meal: ' + err.message))
    },
    fetchRecipes () {
      this.isLoadingRecipes = true
      this.recipes = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/recipes', {
        cancelToken: this.token.token,
        params: { query: this.addedRecipeName, limit: 20 }
      }).then((response) => {
        this.recipes = response.data.data

        this.isLoadingRecipes = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingRecipes = false
        this.showDanger('Could not fetch recipes: ' + err.message)
      })
    },
    selectRecipe (option) {
      this.addedRecipeName = ''
      if (option) {
        this.meal.meals_recipes.push({
          person_count: 0,
          recipe_id: option.id,
          recipe: option
        })
      }
    },
    removeRecipe (index) {
      this.meal.meals_recipes.splice(index, 1)
    },
    saveMeal () {
      this.isLoading = true
      let promise = null
      if (this.isNewMeal) {
        promise = this.axios.post(this.services['alastair'] + '/events/' + this.event.id + '/meals/', { meal: this.meal })
      } else {
        promise = this.axios.put(this.services['alastair'] + '/events/' + this.event.id + '/meals/' + this.meal.id, { meal: this.meal })
      }

      promise.then((response) => {
        this.showSuccess('Meal was saved.')

        this.isLoading = false
        this.$parent.close()
        this.reload()
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) {
          this.errors = err.response.data.errors
          console.log(this.errors)
        }

        this.showDanger(message)
      })
    }
  }
}
</script>