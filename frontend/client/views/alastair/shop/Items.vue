<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <div class="title">
        Shopping items for {{ shop.name }}
      </div>

      <article class="tile is-child">
        <div class="field">
          <label class="label">Search by name</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name" @input="refetch()">
          </div>
        </div>

        <div class="field" v-show="permissions.shop_admin">
          <router-link class="button is-primary is-fullwidth" :to="{name: 'oms.alastair.shop.match', params: {id: shop.id}}">Match new Items</router-link>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Buying quantity</th>
                <th>Mapped ingredient</th>
                <th>Comment</th>
                <th v-show="permissions.shop_admin">Actions</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Buying quantity</th>
                <th>Mapped ingredient</th>
                <th>Comment</th>
                <th v-show="permissions.shop_admin">Actions</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="item in items" v-bind:key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ item.price }}{{ shop.currency.display_code }}</td>
                <td>
                    <span v-show="!item.flexible_amount">{{ item.buying_quantity }}{{ item.mapped_ingredient.default_measurement.display_code }}</span>
                    <span v-show="item.flexible_amount">Flexible</span>
                </td>
                <td>{{ item.mapped_ingredient.name }}</td>
                <td><i><small>{{ item.comment }}</small></i></td>
                <td v-show="permissions.shop_admin">
                  <router-link class="button is-warning" :to="{name: 'oms.alastair.shop.match', params: {id: shop.id, item: item}}"><i class="fa fa-pencil"></i> Rematch</router-link>
                  <button type="button" class="button is-danger" @click="deleteItem(item)"><i class="fa fa-minus"></i> Del</button>
                </td>
              </tr>

              <tr v-show="!items.length && !isLoading">
                <td colspan="4" class="has-text-centered">Item list is empty</td>
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
              @click="fetchItems()">Load more items</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ShoppingItemsList',
  data () {
    return {
      shop: {
        currency: {}
      },
      items: [],
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
  methods: {
    refetch () {
      this.items = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchItems()
    },
    fetchShop () {
      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id).then((response) => {
        this.shop = response.data.data

        return this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id + '/user').then((response) => {
          this.permissions = response.data.data
        })
      }).catch((err) => {
        this.$root.showDanger('Could not fetch shop details: ' + err.message)
      })
    },
    fetchItems (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id + '/shopping_items', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.items = this.items.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch items: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchItems()
    this.fetchShop()
  }
}
</script>
