
<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <p class="help is-danger" v-show="permissions.superuser">You are a alastair-admin, which means you are perfectly aware that you can screw this app with a single click. In case you disagree with this statement, please read the admin manual or contact an actual admin!</p>

      <article class="tile is-child">
        <h4 class="title">Ingredients list</h4>
        <div class="field">
          <label class="label">Search by name</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name" @input="refetch()">
          </div>
        </div>

        <div class="field" v-if="permissions.superuser">
          <div class="control">
            <button type="button" class="button is-primary" v-on:click="openIngredientEditModal(null)">Create Ingredient</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Measurement</th>
                <th v-if="permissions.superuser">Actions</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Measurement</th>
                <th v-if="permissions.superuser">Actions</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="ingredients.length" v-for="ingredient in ingredients" v-bind:key="ingredient.id">
                <td>{{ ingredient.name }}</td>
                <td>
                  <span v-html="$options.filters.markdown(ingredient.description || '')"></span>
                </td>
                <td>{{ ingredient.default_measurement.name }}</td>
                <td v-if="permissions.superuser">
                  <button type="button" class="button is-warning" v-on:click="openIngredientEditModal(ingredient)">Edit</button>
                </td>
              </tr>

              <tr v-show="!ingredients.length && !isLoading">
                <td colspan="4" class="has-text-centered">Ingredients list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="4" class="has-text-centered">
                  <font-awesome-icon style="font-size:24px" :icon="['spinner', 'spin']" />
                </td>
              </tr>
            </tbody>
          </table>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              :class="{ 'is-loading': isLoading }"
              :disabled="isLoading"
              v-show="canLoadMore"
              @click="fetchData()">Load more ingredients</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'
import IngredientEditModal from './IngredientEditModal'

export default {
  name: 'IngredientsList',
  data () {
    return {
      ingredients: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      permissions: {
        superuser: false
      },
      can: {
        create: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    openIngredientEditModal (ingredient = null) {
      let isNewIngredient = false
      if (!ingredient) {
        ingredient = {
          name: '',
          description: '',
          default_measurement: {}
        }
        isNewIngredient = true
      }

      this.$buefy.modal.open({
        component: IngredientEditModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          ingredient,
          isNewIngredient,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          reload: this.refetch
        }
      })
    },
    refetch () {
      this.ingredients = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchPermissions () {
      this.axios.get(this.services.alastair + '/user').then((response) => {
        this.permissions.superuser = response.data.data.superadmin
      }).catch((err) => {
        this.$root.showError('Could not fetch user permissions from alastair', err)
      })
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services.alastair + '/ingredients', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.ingredients = this.ingredients.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch ingredients list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
    this.fetchPermissions()
  }
}
</script>
