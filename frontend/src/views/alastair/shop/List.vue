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
          <button type="button" class="button is-primary" @click="openShopEditModal()"><i class="fa-plus"></i>New</button>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Currency</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Currency</th>
                <th>Actions</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="shop in shops" v-bind:key="shop.id">
                <td>{{ shop.name }}</td>
                <td>{{ shop.location }}</td>
                <td>{{ shop.currency.name }}</td>
                <td>
                  <router-link :to="{name: 'oms.alastair.shop.items', params: {id: shop.id}}" class="button is-primary"><i class="fa-list"></i> Items</router-link>
                  <router-link :to="{name: 'oms.alastair.shop.admins', params: {id: shop.id}}" class="button is-primary"><i class="fa-user"></i> Admins</router-link>
                  <button type="button" v-on:click="openShopEditModal(shop)" class="button is-warning"><i class="fa-pencil"></i> Edit</button>
                </td>
              </tr>

              <tr v-show="!shops.length && !isLoading">
                <td colspan="4" class="has-text-centered">Shop list is empty</td>
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
              @click="fetchData()">Load more shops</button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'
import ShopEditModal from './ShopEditModal'

export default {
  name: 'ShopsList',
  data () {
    return {
      shops: [],
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
    openShopEditModal (shop = null) {
      let isNewShop = false
      if (!shop) {
        shop = {
          name: '',
          location: '',
          currency: {}
        }
        isNewShop = true
      }

      this.$buefy.modal.open({
        component: ShopEditModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          shop: shop,
          isNewShop: isNewShop,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          reload: this.refetch
        }
      })
    },
    refetch () {
      this.shops = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData (state) {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/shops', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.shops = this.shops.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch shop list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
