<template>
  <div>
    <span v-if="event">
      <h1>{{ event.name }}</h1>

      <h5 v-if="event.shop">Assigned shop: <router-link :to="{name: 'oms.alastair.shopping.items', params: {id: event.shop.id}}">{{ event.shop.name }}</router-link> ({{ event.shop.location }}, currency {{ event.shop.currency.name }})</h5>
      <h5 v-if="!event.shop">Assign a shop to enjoy the full shopping list feature</h5>
      <router-link :to="{name: 'oms.alastair.organizer.change_shop', params: {id: event.id}}"  class="btn btn-warning"><i class="fa fa-pencil"></i>Change shop</router-link>
      <router-link :to="{name: 'oms.alastair.organizer.shopping_list', params: {id: event.id}}" class="btn btn-primary"><i class="fa fa-shopping-cart"></i> Shopping list</router-link>


      <hr>
      <h2>Meals  <router-link class="btn btn-primary" :to="{name: 'oms.alastair.organizer.edit_meal', params: {event_id: event.id}}"><i class="fa fa-plus"></i> New</router-link>
      </h2>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Meal</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="meal in meals">
              <td>{{ meal.date | date:'EEE d.M'}}</td>
              <td>
                <router-link class="btn btn-primary" :to="{name: 'oms.alastair.organizer.single_meal', params: { id: meal.id }}">{{ meal.name }}</router-link>
                <ul>
                  <li v-for="mr in meal.meals_recipes">
                    {{ mr.person_count }} ppl <router-link :to="{name: 'oms.alastair.chef.single_recipe', params: { id: mr.recipe.id }}">{{ mr.recipe.name }}</router-link>
                  </li> 
                </ul>
              </td>
              <td>{{ meal.time | date:'hh:mm'}}</td>
              <td>
                <router-link class="btn btn-primary" :to="{name: 'oms.alastair.organizer.single_meal', params: {event_id: event.id, meal_id: meal.id}}"><i class="fa fa-list"></i> Show</router-link>
                <router-link class="btn btn-warning" :to="{name: 'oms.alastair.organizer.edit_meal', params: {event_id: event.id, meal_id: meal.id}}"><i class="fa fa-pencil"></i> Edit</router-link>
                <button type="button" class="btn btn-danger btn-sm" v-on:click="deleteMeal (meal);"><i class="fa fa-minus"></i> Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </span>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AlastairSingleEvent',
  data () {
    return {
      event: {},
      meals: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    refetch () {
      this.event = {}
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true

      // Fetch event itself
      this.axios.get(this.services['alastair'] + '/events/' + this.$route.params.id)
        .then((response) => {
          this.isLoading = false
          this.event = response.data.data
        }).catch((err) => {
          this.$root.showDanger('Could not fetch alastair event with id ' + this.$route.params.id + ': ' + err.message)
        })

      // Fetch meals
      this.axios.get(this.services['alastair'] + '/events/' + this.$route.params.id + '/meals')
        .then((response) => {
          this.meals = response.data.data
        }).catch((err) => {
          this.$root.showDanger('Could not fetch alastair event meals: ' + err.message)
        })
    },
    deleteMeal (meal) {
      console.log('Deleting meal')
      console.log(meal)
    }
  },
  watch: {
    '$route.name' () {
      this.fetchData()
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>