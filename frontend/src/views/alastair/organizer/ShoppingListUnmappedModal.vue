<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Unmapped items for {{ event.name }} </p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <h6>Not all ingredients could be matched to a shopping item! For a correct price calculation, match all items in the shop.</h6>

      <table class="table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Needed Quantity</th>
            <th>Ingredient Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in unmapped" v-bind:key="index">
            <td>{{ item.ingredient.name }}</td>
            <td>{{ item.calculated_quantity }}{{ item.ingredient.default_measurement.display_code }}</td>
            <td>{{ item.ingredient.description}}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ShoppingListUnmappedModal',
  props: ['unmapped', 'event']
}
</script>