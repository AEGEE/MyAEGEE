<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div class="title">
        Matching in 
        <router-link :to="{name: 'oms.alastair.shop.items', params: {id: shop.id}}">{{ shop.name }}</router-link>
      </div>
      <div class="subtitle" v-if="item.mapped_ingredient && item.mapped_ingredient.name">
        Matching ingredient {{ item.mapped_ingredient.name }}
      </div>

      <form @submit.prevent="saveMatch()">

        <div class="field">
          <label class="label">Ingredient</label>
          <b-autocomplete
            v-model="mappedIngredientName"
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

        <span v-if="item.mapped_ingredient && item.mapped_ingredient.default_measurement">
          <div class="field">
            <label class="label">Can you buy flexible amounts?</label>
            <div class="select">
              <select v-model="item.flexible_amount">
                <option v-bind:value="false">No, price is per item</option>
                <option v-bind:value="true">Yes, price is flexible</option>
              </select>
            </div>
          </div>

          <span v-if="item.flexible_amount">
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

          <span v-if="!item.flexible_amount">
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
            <input class="input" placeholder="e.g. Hello world" v-model="item.comment" />
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
        currency: {},
        id: null
      },
      item: {
        mapped_ingredient: null,
        name: '',
        price: null,
        flexible_amount: false,
        comment: ''
      },
      mappedIngredientName: '',
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
        params: { query: this.mappedIngredientName, limit: 20 }
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
        this.item.mapped_ingredient = ing
        this.item.mapped_ingredient_id = ing.id
        console.log(ing)
      }
    },
    fetchShop () {
      this.isLoading = true
      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id).then((response) => {
        this.shop = response.data.data

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
    fetchItem () {
      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id + '/shopping_items/' + this.$route.params.item).then((response) => {
        this.item = response.data.data
        if (this.item.mapped_ingredient && this.item.mapped_ingredient.name) {
          this.mappedIngredientName = this.item.mapped_ingredient.name
        }
      }).catch((err) => {
        this.$root.showDanger('Could not fetch item ' + err.message)
      })
    },
    saveMatch () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.item
        ? this.axios.put(this.services['alastair'] + '/shops/' + this.$route.params.id + '/shopping_items/' + this.$route.params.item, {shopping_item: this.item})
        : this.axios.post(this.services['alastair'] + '/shops/' + this.$route.params.id + '/shopping_items', {shopping_item: this.item})

      promise.then((response) => {
        this.isSaving = false

        if (this.$route.params.item) {
          this.$router.push({name: 'oms.alastair.shop.items', params: { id: this.$route.params.id }})
        } else {
          this.$root.showSuccess('Item is saved. You can match another item now')
          this.item = {
            mapped_ingredient: null,
            name: '',
            price: null,
            flexible_amount: false,
            comment: ''
          }
          this.mappedIngredientName = ''
        }
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the item data is invalid.')
        }

        this.$root.showDanger('Could not save item: ' + err.message)
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

    if (this.$route.params.item) {
      this.fetchItem()
    }
  }
}
</script>
