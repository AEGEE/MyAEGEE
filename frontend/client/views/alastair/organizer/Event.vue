<template>
  <div>
    <span v-if="event">
      <h1>{{ event.name }}</h1>

      <h5 v-if="event.shop">Assigned shop: <router-link :to="{name: 'oms.alastair.shopping.items', params: {id: event.shop.id}}">{{ event.shop.name }}</router-link> ({{ event.shop.location }}, currency {{ event.shop.currency.name }})</h5>
      <h5 v-if="!event.shop">Assign a shop to enjoy the full shopping list feature</h5>
      <button type="button" @click="openChangeShopModal" class="button is-warning"><i class="fa fa-pencil"></i>Change shop</button>
      <router-link :to="{name: 'oms.alastair.organizer.shopping_list', params: {id: event.id}}" class="button is-primary"><i class="fa fa-shopping-cart"></i> Shopping list</router-link>


      <hr>
      <h2>Meals  <button class="button is-primary" @click="openEditMealModal(null)"><i class="fa fa-plus"></i> New</button>
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
            <tr v-for="(meal, index) in meals"  v-bind:key="index">
              <td>{{ meal.date | date:'EEE d.M'}}</td>
              <td>
                <router-link class="btn btn-primary" :to="{name: 'oms.alastair.organizer.meal.single', params: { event_id: event.id, id: meal.id }}">{{ meal.name }}</router-link>
                <ul>
                  <li v-for="(mr, mrIndex) in meal.meals_recipes"  v-bind:key="mrIndex">
                    {{ mr.person_count }} ppl <router-link :to="{name: 'oms.alastair.chef.recipe.single', params: { id: mr.recipe.id }}">{{ mr.recipe.name }}</router-link>
                  </li> 
                </ul>
              </td>
              <td>{{ meal.time | date:'hh:mm'}}</td>
              <td>
                <router-link class="button is-primary" :to="{name: 'oms.alastair.organizer.meal.single', params: {event_id: event.id, id: meal.id}}"><i class="fa fa-list"></i> Show</router-link>
                <button type="button" class="button is-warning" @click="openEditMealModal(meal)"><i class="fa fa-pencil"></i> Edit</button>
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
import ChangeShopModal from './ChangeShopModal'
import EditMealModal from './EditMealModal'

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
    openChangeShopModal () {
      this.$buefy.modal.open({
        component: ChangeShopModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          event: this.event,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess,
          reload: this.refetch
        }
      })
    },
    openEditMealModal (meal = null) {
      let isNewMeal = false
      if (!meal) {
        meal = {
          name: '',
          date: null,
          meals_recipes: []
        }
        isNewMeal = true
      }

      this.$buefy.modal.open({
        component: EditMealModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          meal: meal,
          event: this.event,
          isNewMeal: isNewMeal,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess,
          reload: this.refetch
        }
      })
    },
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