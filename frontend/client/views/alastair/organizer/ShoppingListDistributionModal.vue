<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Distribution for {{ item.ingredient.name }} </p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <h6>Needed: {{ item.calculated_quantity }}{{ item.ingredient.default_measurement.display_code }}</h6>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Meal name</th>
              <th>Date</th>
              <th>Time</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(meal, index) in item.used_in_meals" v-bind:key="index">
              <td><a @click="goToMeal(meal)">{{ meal.name }}</a></td>
              <td>{{ meal.date | date }}</td>
              <td>{{ meal.time | time}}</td>
              <td>{{ meal.quantity }} {{ item.ingredient.default_measurement.display_code }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ShoppingListDistributionModal',
  props: ['item', 'event_id', 'router'],
  methods: {
    // router-link doesn't work because the component has no access to this.$router, so we have to reimplement that functionality
    goToMeal (meal) {
      this.$parent.close()
      this.router.push({name: 'oms.alastair.organizer.meal.single', params: {id: meal.id, event_id: this.event_id}})
    }
  }
}
</script>