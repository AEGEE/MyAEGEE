
<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">

      <article class="tile is-child">
        <div class="field">
          <label class="label">Search by name</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name" @input="refetch()">
          </div>
        </div>

        <div class="control">
          <router-link class="button is-primary" :to="{name: 'oms.alastair.chef.recipe.list', params: {which: 'mine'}}" v-if="!$route.params.which">Show my recipes</router-link>
          <router-link class="button is-primary" :to="{name: 'oms.alastair.chef.recipe.list'}" v-if="$route.params.which">Show all recipes</router-link>
          <router-link class="button is-primary" :to="{name: 'oms.alastair.chef.recipe.edit'}">New</router-link>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Rating</th>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Rating</th>
                <th>Name</th>
                <th>Description</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="recipes.length" v-for="recipe in recipes" v-bind:key="recipe.id">
                <td>{{ recipe.avg_rating }}</td>
                <td><router-link :to="{name: 'oms.alastair.chef.recipe.single', params: {id: recipe.id}}">{{ recipe.name }}</router-link></td>
                <td>
                  <span v-html="$options.filters.markdown(recipe.description || '')"></span>
                </td>
              </tr>

              <tr v-show="!recipes.length && !isLoading">
                <td colspan="4" class="has-text-centered">Recipes list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="4" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>

          <div class="field">
            <button
              class="button is-primary is-fullwidth"
              :class="{ 'is-loading': isLoading }"
              :disabled="isLoading"
              v-show="canLoadMore"
              @click="fetchData()">Load more recipes</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'RecipesList',
  data () {
    return {
      recipes: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      permissions: {},
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
  watch: {
    '$route.params.which': 'refetch'
  },
  methods: {
    refetch () {
      this.recipes = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      const url = this.services.alastair + (this.$route.params.which === 'mine' ? '/my_recipes' : '/recipes')

      this.axios.get(url, { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.recipes = this.recipes.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch recipes list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
