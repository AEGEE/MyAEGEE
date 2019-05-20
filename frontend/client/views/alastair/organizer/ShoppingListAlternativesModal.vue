<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Choose shopping item alternative for {{ item.ingredient.name }}</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <h6>Needed: {{ item.calculated_quantity }}{{ getMeasurement() }}</h6>

      <table class="table">
        <thead>
          <tr>
            <th>Alternative item</th>
            <th>Buying amount</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in item.items" v-bind:key="index">
            <td>
              {{ item.shopping_item.name }}
            </td>
            <td>{{ item.item_buying_quantity  }}{{ getMeasurement() }} ({{ item.item_count }} items)</td>
            <td>{{ item.item_price }}{{ event.shop.currency.display_code }}</td>
            <td>
              <button type="button" class="button is-primary" @click="chooseAltItem(item)"><i class="fa fa-check-circle"></i> Choose</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ShoppingListAlternativesModal',
  props: ['item', 'event', 'services', 'showSuccess', 'showDanger', 'reload'],
  methods: {
    // I have not the slightest clue why direct binding to that value didn't work
    getMeasurement () {
      return this.item.ingredient.default_measurement.display_code
    },
    chooseAltItem (selectedItem) {
      this.item.note.shopping_item_id = selectedItem.shopping_item_id

      this.axios.put(this.services['alastair'] + '/events/' + this.event.id + '/shopping_list/note/' + this.item.ingredient_id, {note: this.item.note}).then((response) => {
        this.showSuccess('Item saved')
        this.reload()
        this.$parent.close()
      }).catch((err) => {
        this.showError('Could not save item choice: ' + err.message)
      })
    }
  }
}
</script>