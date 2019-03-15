<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveRecipe()">

        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" v-model="recipe.name" required/>
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="recipe.description"></textarea>
          </div>
          <label class="label">Description preview</label>
          <div class="content">
            <span v-html="$options.filters.markdown(recipe.description)">
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>        

        <div class="field">
          <label class="label">Instructions</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="recipe.instructions"></textarea>
          </div>
          <label class="label">Instructions preview</label>
          <div class="content">
            <span v-html="$options.filters.markdown(recipe.instructions)">
          </div>
          <p class="help is-danger" v-if="errors.instructions">{{ errors.instructions.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Person count</label>
          <div class="control">
            <input class="input" type="number" v-model="recipe.person_count" min="1" required />
          </div>
          <p class="help is-danger" v-if="errors.person_count">{{ errors.person_count.join(', ') }}</p>
        </div>

        <hr/>
        <div class="subtitle is-fullwidth has-text-centered">Ingredients <small>for {{ recipe.person_count }} persons</small></div>

        <table class="table is-fullwidth is-narrowed">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ri, index) in recipe.recipes_ingredients">
              <td>{{ ri.ingredient.name }}</td>
              <td>
                 <div class="field">
                  <div class="control">
                    <div class="field has-addons">
                      <div class="control">
                        <input class="input" type="number" v-model="ri.quantity" min="0" step="0.0001" required />
                      </div>
                      <div class="control">
                        <a class="button is-static">{{ ri.ingredient.default_measurement.display_code }}</a>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p class="help is-danger" v-if="errors.recipes_ingredients && errors.recipes_ingredients[index] && errors.recipes_ingredients[index] !== {}">
                  <span v-for="(value, key) in errors.recipes_ingredients[index]">
                    Error in {{ key }}: {{ value.join(', ') }}
                  </span>
                </p>
              </td>
              <td>
                <button type="button" class="btn btn-warn" v-on:click="removeIngredient(index)"><i class="fa-minus"></i> Del</button>
              </td>
            </tr>
            <tr>
              <td colspan="3">
              <label>Add an ingredient</label>
               <b-autocomplete
                v-model="addedIngredientName"
                :data="ingredients"
                field="name"
                :loading="isLoadingIngredients"
                @input="fetchIngredients"
                expanded="true"
                @select="option => selectIngredient(option)">

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


        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save recipe" :disabled="isSaving || isLoading" class="button is-primary is-fullwidth"/>
          </div>
        </div>
        <div class="field">
          <div class="control">
            <input type="button" value="Publish recipe" :disabled="isSaving || isLoading || !recipe.id" v-on:click="publishRecipe(true)" v-if="!recipe.published" class="button is-warning is-fullwidth" />
            <input type="button" value="Unpublish recipe" :disabled="isSaving || isLoading" v-on:click="publishRecipe(false)" v-if="recipe.published" class="button is-warning is-fullwidth" />
          </div>
        </div> 
        <div class="field">
          <div class="control">
            <input type="button" value="Delete recipe" :disabled="isSaving || isLoading || !can.delete_recipe" v-on:click="askDeleteRecipe" class="button is-danger is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditRecipe',
  data () {
    return {
      recipe: {
        name: null,
        description: '',
        instructions: '',
        recipes_ingredients: [],
        person_count: null
      },
      addedIngredientName: '',
      ingredients: [],
      isLoadingIngredients: false,
      can: {
        edit_application_status: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    fetchIngredients () {
      this.isLoadingIngredients = true
      this.ingredients = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/ingredients', {
        cancelToken: this.token.token,
        params: { query: this.addedIngredientName, limit: 20 }
      }).then((response) => {
        this.ingredients = response.data.data

        this.isLoadingIngredients = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingIngredients = false
        this.$root.showDanger('Could not fetch ingredients: ' + err.message)
      })
    },
    selectIngredient (ing) {
      this.addedIngredientName = ''
      if (ing) {
        this.recipe.recipes_ingredients.push({
          quantity: 0,
          ingredient_id: ing.id,
          ingredient: ing
        })
      }
    },
    removeIngredient (index) {
      this.recipe.recipes_ingredients.splice(index, 1)
    },
    publishRecipe (status) {
      this.recipe.published = status
      this.saveRecipe()
    },
    saveRecipe () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['alastair'] + '/recipes/' + this.$route.params.id, {recipe: this.recipe})
        : this.axios.post(this.services['alastair'] + '/recipes/', {recipe: this.recipe})

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Recipe is saved.')
        this.recipe = response.data.data

        return this.$router.push({
          name: 'oms.alastair.chef.recipe.single',
          params: { id: this.recipe.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the recipe data is invalid.')
        }

        this.$root.showDanger('Could not save recipe: ' + err.message)
      })
    },
    askDeleteRecipe () {
      this.$dialog.confirm({
        title: 'Deleting an recipe',
        message: `Are you sure you want to <b>delete this recipe</b>?`,
        confirmText: 'Delete recipe',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteRecipe()
      })
    },
    deleteRecipe () {
      this.axios.delete(this.services['alastair'] + '/recipes/' + this.$route.params.id).then((response) => {
        this.$root.showInfo('Recipe is deleted.')
        this.$router.push({ name: 'oms.alastair.chef.recipe.list' })
      }).catch((err) => this.$root.showDanger('Could not delete recipe: ' + err.message))
    }
  },
  computed: mapGetters({services: 'services'}),
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true
    this.axios.get(this.services['alastair'] + '/recipes/' + this.$route.params.id).then((response) => {
      this.recipe = response.data.data
      this.can = response.data.meta.permissions

      if (!this.can.edit_recipe) {
        this.$root.showDanger('You don\'t have permission to edit this recipe')
        this.$router.push({name: 'oms.alastair.chef.recipe.single', params: {id: this.recipe.id}})
      }

      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Recipe not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.alastair.chef.recipe.list' })
    })
  }
}
</script>
