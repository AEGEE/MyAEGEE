<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">

      <article class="tile is-child">

        <div class="control">
          <router-link class="button is-primary" :to="{name: 'oms.alastair.organizer.event', params: {id: event.id}}">Back to {{ event.name }}</router-link>
          <button type="button" class="button is-primary" @click="detailed_view=true" v-if="!detailed_view">Detailed View</button>
          <button type="button" class="button is-primary" @click="detailed_view=false" v-if="detailed_view">Simple View</button>
          <button type="button" class="button is-warning" @click="showUnmappedItems()" v-if="unmapped.length !== 0">You have {{ unmapped.length }} unmapped items</button>
        </div>


        <table class="table">
          <thead>
            <tr>
              <th>Chosen item</th>
              <th>Needed Quantity</th>
              <th>Buying amount</th>
              <th>Price</th>
              <th>Ingredient</th>

              <th v-show="detailed_view">Item Comments</th>
              <th v-show="detailed_view">Ingredient Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ingredient, index) in ingredients" v-bind:key="index">
              <td>
                <input type="checkbox" @change="checkboxTicked(ingredient)" v-model="ingredient.note.ticked">
                <i class="fa fa-hourglass-start" v-show="ingredient.note_loading">...</i>
                {{ ingredient.chosen_item.shopping_item.name }}
                <span v-shop="detailed_view">
                  <br>
                  <button type="button" class="button is-primary" v-show="detailed_view && ingredient.items.length > 1" @click="showAlternatives(ingredient)">Show alternatives</button>
                </span>
              </td>

              <td>
                {{ ingredient.calculated_quantity }}{{ ingredient.ingredient.default_measurement.display_code }}
                <span v-show="detailed_view">
                  <br>
                  <button type="button" class="button is-primary" v-show="detailed_view" @click="showDistribution(ingredient)">Show distribution</button>
                </span>
              </td>
              <td>
                {{ ingredient.chosen_item.item_buying_quantity }}{{ ingredient.ingredient.default_measurement.display_code }}
                <span v-show="detailed_view">({{ ingredient.chosen_item.item_count }} items)</span>
              </td>
              <td>{{ ingredient.chosen_price }}{{ event.shop.currency.display_code }}</td>
              <td>{{ ingredient.ingredient.name }}</td>
              <td v-show="detailed_view"><i><small>{{ ingredient.chosen_item.shopping_item.comment }}</small></i></td>
              <td v-show="detailed_view">{{ ingredient.ingredient.description}}</td>
            </tr>
            <tr>
              <td><b>Total: {{ accumulates.count }} items</b></td>
              <td></td>
              <td></td>
              <td><b v-if="event.shop && event.shop.currency">{{ accumulates.price | number:2 }}{{ event.shop.currency.display_code }}</b></td>
              <td></td>
              <td v-show="detailed_view" colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'
import ShoppingListDistributionModal from './ShoppingListDistributionModal'
import ShoppingListAlternativesModal from './ShoppingListAlternativesModal'
import ShoppingListUnmappedModal from './ShoppingListUnmappedModal'

export default {
  name: 'ShoppingList',
  data () {
    return {
      detailed_view: false,
      ingredients: [],
      accumulates: [],
      unmapped: [],
      event: {
        shop: {
          currency: {}
        }
      },
      isLoading: false,
      isLoadingShoppingList: false,
      isLoadingEvent: false,
      source: null,
      permissions: {},
      can: {
        create: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {}

      if (this.query_to) queryObj.to = this.query_to
      if (this.query_from) queryObj.from = this.query_from

      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    convertToCsv (data) {
      const escape = (str) => {
        if (!str) {
          return ''
        }
        let result = str.toString().replace(/"/g, '""')
        if (result.search(/("|,|\n)/g) >= 0) {
          result = '"' + result + '"'
        }
        return result
      }

      const labels = []
      data.forEach((obj) => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && !labels.find((label) => label === key)) {
            labels.push(key)
          }
        }
      })

      let csvContent = ''

      csvContent += labels.map(escape).join(',') + '\n'

      csvContent += data.map((obj) => {
        const tmp = []
        labels.forEach((label) => {
          tmp.push(escape(obj[label]))
        })
        return tmp.join(',')
      }).join('\n')
      return csvContent
    },
    downloadCSV (data) {
      const list = data.map((item) => {
        const retval = {
          needed_quantity: item.calculated_quantity,
          ingredient_name: item.ingredient.name,
          measurement: item.ingredient.default_measurement.name,
          ticked: false
        }
        if (item.chosen_item) {
          retval.price = item.chosen_price
          retval.item_quantity = item.chosen_item.item_buying_quantity
          retval.item_unit_count = item.chosen_item.item_count
          retval.item_name = item.chosen_item.shopping_item.name
          retval.item_unit_price = item.chosen_item.shopping_item.price
          retval.item_unit_quantity = item.chosen_item.shopping_item.buying_quantity
          retval.item_comment = item.chosen_item.shopping_item.comment
        }
        if (item.note) {
          retval.ticked = item.note.ticked
        }

        return retval
      })

      const csvString = this.convertToCsv(list) // defined above
      const a = document.createElement('a')
      a.href = 'data:attachment/csv,' + encodeURIComponent(csvString)
      a.target = '_blank'
      a.download = 'shopping_list.csv'

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
    checkboxTicked (ingredient) {
      ingredient.note_loading = true

      this.axios.put(this.services.alastair + '/events/' + this.$route.params.id + '/shopping_list/note/' + ingredient.ingredient_id, { note: ingredient.note }).then(() => {
        ingredient.note_loading = false
      }).catch((err) => {
        this.$root.showError('Could not tick ingredient', err)
        ingredient.note_loading = false
      })
    },
    showDistribution (item) {
      this.$buefy.modal.open({
        component: ShoppingListDistributionModal,
        hasModalCard: true,
        props: {
          item,
          event_id: this.$route.params.id,
          router: this.$router
        }
      })
    },
    showAlternatives (item) {
      this.$buefy.modal.open({
        component: ShoppingListAlternativesModal,
        hasModalCard: true,
        props: {
          item,
          event: this.event,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          services: this.services,
          reload: this.fetchData
        }
      })
    },
    showUnmappedItems () {
      this.$buefy.modal.open({
        component: ShoppingListUnmappedModal,
        hasModalCard: true,
        props: {
          unmapped: this.unmapped,
          event: this.event
        }
      })
    },
    fetchData () {
      this.isLoading = true
      this.isLoadingEvent = true
      this.isLoadingShoppingList = true

      this.axios.get(this.services.alastair + '/events/' + this.$route.params.id).then((response) => {
        this.event = response.data.data
        this.isLoadingEvent = false
        this.isLoading = this.isLoadingEvent || this.isLoadingShoppingList
      }).catch((err) => {
        this.$root.showError('Could not load event details', err)
      })

      this.axios.get(this.services.alastair + '/events/' + this.$route.params.id + '/shopping_list/', { params: this.queryObject }).then((response) => {
        // Not every ingredient will have a note associated with it
        // Also round values to a sensible value
        this.ingredients = response.data.data.mapped.map((item) => {
          if (item.note === null) {
            item.note = { ticked: false }
          }
          item.chosen_price = Math.round(item.chosen_price * 100) / 100
          item.calculated_quantity = Math.round(item.calculated_quantity * 1000) / 1000
          item.chosen_item.buying_quantity = Math.round(item.chosen_item.buying_quantity * 1000) / 1000

          return item
        })
        this.unmapped = response.data.data.unmapped.map((item) => {
          item.calculated_quantity = Math.round(item.calculated_quantity * 1000) / 1000
          return item
        })
        this.accumulates = response.data.data.accumulates
        this.accumulates.price = Math.round(this.accumulates.price * 100) / 100

        this.isLoadingShoppingList = false
        this.isLoading = this.isLoadingEvent || this.isLoadingShoppingList
      }).catch((err) => {
        this.$root.showError('Could not load shopping list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
