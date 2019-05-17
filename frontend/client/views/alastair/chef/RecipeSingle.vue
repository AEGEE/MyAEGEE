<template>
  <div>
    <div class="title">
      {{ recipe.name }}
    </div>
    <div class="subtitle">
      for {{ recipe.person_count }} persons by 
      <router-link :to="{name: 'oms.members.view', params: {id: recipe.created_by}}">this member</router-link> 
      <span v-if="recipe.published">(published</span><span v-if="!recipe.published">(unpublished</span>
      , version {{ recipe.version }})
    </div>

    <div class="article">
      <span v-html="$options.filters.markdown(recipe.description || '')"></span>
    </div>

    <table class="table table-responsive">
      <tbody>
        <tr v-for="(ri, index) in recipe.recipes_ingredients" v-bind:key="index">
          <td style="text-align: right;">{{ ri.quantity }}&nbsp;{{ ri.ingredient.default_measurement.display_code }}</td>
          <td>{{ ri.ingredient.name }}</td>
          <td><small><i>{{ ri.comment | limitTo:100 }}</i></small></td>
        </tr>
      </tbody>
    </table>

    <div class="article">
      <h4 class="subtitle">Instructions</h4>
      <span v-html="$options.filters.markdown(recipe.instructions || '')"></span>
    </div>

    <div>
      <router-link type="button" class="button is-warning" :to="{name: 'oms.alastair.chef.recipe.edit', params: {id: recipe.id, recipe: recipe}}" v-show="permissions.edit_recipe"><i class="fa-pencil"></i>&nbsp;Edit</router-link>
    </div>

    <!-- TODO: Review mechanism -->

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'RecipeSingle',
  data () {
    return {
      recipe: {recipes_ingredients: []},
      isLoading: false,
      permissions: {}
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    fetchData (state) {
      this.isLoading = true

      this.axios.get(this.services['alastair'] + '/recipes/' + this.$route.params.id).then((response) => {
        this.recipe = response.data.data
        this.permissions = response.data.meta.permissions
        this.isLoading = false
      }).catch((err) => {
        this.$root.showDanger('Could not fetch recipe: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
