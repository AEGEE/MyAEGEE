<template>
  <div >
    <div class="section">
      <div class="title">
        {{ meal.name }}
      </div>
      <div class="subtitle">
        in event 
        <router-link :to="{name: 'oms.alastair.organizer.event', params: {id: event.id}}">{{ event.name }}</router-link> 
      </div>

      <div class="article">
        Date: {{ meal.date }}, Time: {{ meal.time }}
      </div>


      <table class="table table-responsive">
        <tbody>
          <tr v-for="(mr, index) in meal.meals_recipes" v-bind:key="index">
            <td style="text-align: right;">{{ mr.person_count }} ppl</td>
            <td>{{ mr.recipe.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section" v-for="(mr, index) in meal.meals_recipes" v-bind:key="index">
      <hr />
      <div class="title">
        <router-link :to="{name: 'oms.alastair.chef.recipe.single', params: {id: mr.recipe_id}}">{{ mr.recipe.name }} (version {{ mr.recipe.version }})</router-link> for {{ mr.person_count }} ppl
      </div>

      <div class="article">
        <span v-html="$options.filters.markdown(mr.recipe.description || '')"></span>
      </div>

      <table class="table table-responsive">
        <tbody>
          <tr v-for="(ri, riIndex) in mr.recipe.recipes_ingredients"  v-bind:key="riIndex">
            <td style="text-align: right;">{{ ri.item_quantity }}&nbsp;{{ ri.ingredient.default_measurement.display_code }}</td>
            <td>{{ ri.ingredient.name }}</td>
            <td><small><i>{{ ri.comment | limitTo:100 }}</i></small></td>
          </tr>
        </tbody>
      </table>

      <div class="article">
        <h4 class="subtitle">Instructions</h4>
        <span v-html="$options.filters.markdown(mr.recipe.instructions || '')"></span>
      </div>
    </div>
    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MealSingle',
  data () {
    return {
      meal: {
        time: null,
        date: null,
        name: '',
        meals_recipes: []
      },
      event: {
        id: null,
        name: ''
      },
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    fetchData (state) {
      this.isLoading = true

      this.axios.get(this.services['alastair'] + '/events/' + this.$route.params.event_id).then((response) => {
        this.event = response.data.data

        this.axios.get(this.services['alastair'] + '/events/' + this.$route.params.event_id + '/meals/' + this.$route.params.id).then((response) => {
          this.meal = response.data.data

          this.isLoading = false
        })
      }).catch((err) => {
        this.$root.showError('Could not fetch meal or event', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
