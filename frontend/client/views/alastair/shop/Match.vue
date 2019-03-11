<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div class="title" v-if="shop.id">
        Matching for 
        <router-link :to="{name: 'oms.alastair.shop.items', params: {id: shop.id}}">{{ shop.name }}</router-link>
      </div>
      <div class="subtitle" v-if="item.mapped_ingredient.name">
        Matching ingredient {{ item.mapped_ingredient.name }}
      </div>

      <form @submit.prevent="saveMatch()">

        <div class="field">
          <label class="label">Ingredient</label>
          <b-autocomplete
            v-model="matchedIngredientName"
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
          <p class="help is-danger" v-if="errors.mapped_ingredient_id">{{ errors.mapped_ingredient_id.join(', ') }}</p>
          <p class="help is-danger" v-if="errors.mapped_ingredient">{{ errors.mapped_ingredient.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" v-model="item.name" required/>
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Price</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <input class="input" type="number" v-model="item.price" min="0" step="0.01" required />
              </div>
              <div class="control">
                <a class="button is-static">{{ shop.currency.display_code }}</a>
              </div>
            </div>
          </div>
        </div>

        <span v-if="item.mapped_ingredient">
          <div class="select">
            <select v-model="item.flexible_amount">
              <option @value="false">Price is per item</option>
              <option @value="true">Price is per weight</option>
            </select>
          </div>

          <span v-if="item.flexible_amount === true">
            <div class="field">
              <label class="label">For every ... </label>
              <div class="control">
                <div class="field has-addons">
                  <div class="control">
                    <input class="input" type="number" v-model="item.buying_quantity" min="0" step="0.0001" required />
                  </div>
                  <div class="control">
                    <a class="button is-static">{{ item.mapped_ingredient.default_measurement.name }}</a>
                  </div>
                </div>
              </div>
            </div>
          </span>

          <span v-if="item.flexible_amount === false">
            <div class="field">
              <label class="label">For every pack of... </label>
              <div class="control">
                <div class="field has-addons">
                  <div class="control">
                    <input class="input" type="number" v-model="item.buying_quantity" min="0" step="0.0001" required />
                  </div>
                  <div class="control">
                    <a class="button is-static">{{ item.mapped_ingredient.default_measurement.name }}</a>
                  </div>
                </div>
              </div>
            </div>
          </span>

          <div class="field">
            <label class="label"> ... you have to pay</label>
            <div class="control">
              <div class="field has-addons">
                <div class="control">
                  <input class="input" type="number" v-model="item.price" min="0" step="0.01" required />
                </div>
                <div class="control">
                  <a class="button is-static">{{ shop.currency.display_code }}</a>
                </div>
              </div>
            </div>
          </div>
        </span>

        <div class="field">
          <label class="label">Comment</label>
          <div class="control">
            <input class="input" placeholder="e.g. Hello world" required v-model="item.comment"></textarea>
          </div>
          <p class="help is-danger" v-if="errors.comment">{{ errors.comment.join(', ') }}</p>
        </div>        

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save item" :disabled="isSaving || isLoading" class="button is-primary is-fullwidth"/>
          </div>
        </div>
        <div class="field" v-if="item.id">
          <div class="control">
            <input type="button" value="Delete item" :disabled="isSaving || isLoading" v-on:click="askDeleteItem" class="button is-danger is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MatchIngredient',
  data () {
    return {
      shop: {
        name: '',
        currency: {}
      },
      item: {
        mapped_ingredient: null,
        name: '',
        price: null,
        flexible_amount: false,
        comment: '',
        instructions: '',
        recipes_ingredients: [],
        person_count: null
      },
      matchedIngredientName: '',
      ingredients: [],
      isLoadingIngredients: false,
      permissions: {},
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
        params: { query: this.matchedIngredientName, limit: 20 }
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
      if (ing) {
        this.item.matched_ingredient = ing
        this.item.matched_ingredient_id = ing.id
      }
    },
    fetchShop () {
      this.isLoading = true
      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id).then((response) => {
        this.shop = response.data.data
        console.log('saved shop')
        console.log(this.shop)

        return this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id + '/user').then((response) => {
          this.permissions = response.data.data
          this.isLoading = false

          if (!this.permissions.shop_admin) {
            this.$root.showDanger('You don\'t have permission to edit match in this shop')
            this.$router.push({name: 'oms.alastair.shop.items', params: {id: this.$route.params.id}})
          }
        })
      }).catch((err) => {
        let message = (err.response.status === 404) ? 'Shop not found' : 'Some error happened while fetching shop details: ' + err.message

        this.$root.showDanger(message)
      })
    },
    saveMatch () {
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
    askDeleteItem () {
      this.$dialog.confirm({
        title: 'Deleting an item',
        message: `Are you sure you want to <b>delete this item</b>?`,
        confirmText: 'Delete item',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteItem()
      })
    },
    deleteItem () {
      this.axios.delete(this.services['alastair'] + '/shops/' + this.$route.params.id + '/shopping_items/' + this.item.id).then((response) => {
        this.$root.showInfo('Item is deleted.')
        this.$router.push({name: 'oms.alastair.shop.items', params: {id: this.$route.params.id}})
      }).catch((err) => this.$root.showDanger('Could not delete item: ' + err.message))
    }
  },
  computed: mapGetters({services: 'services'}),
  mounted () {
    this.fetchShop()
  }
}
</script>
