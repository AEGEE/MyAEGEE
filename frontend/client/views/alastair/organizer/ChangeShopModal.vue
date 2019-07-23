<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Change Shop</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
    <article class="message is-warning">
      <div class="message-body">
        When you change the shop you will loose all ticked items and item choices in the shopping list
      </div>
    </article>
      
      <div class="field">
        <label class="label">Select Shop</label>
        <b-autocomplete
          v-model="addedShopName"
          :data="shops"
          field="name"
          :loading="isLoadingShops"
          @input="fetchShops"
          expanded="true"
          @select="option => selectShop(option)">

          <template slot-scope="props">
            <div class="media">
              <div class="media-content">{{ props.option.name }}</div>
            </div>
          </template>
        </b-autocomplete>

        <div style="height: 100px"></div>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveShop(shop)" v-if="shop.name">Switch to {{ shop.name }}</button>
      <button class="button is-primary" @click="saveShop(null)" v-if="event.shop">Clear shop ({{ event.shop.name }})</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'ChangeShopModal',
  props: ['event', 'services', 'showSuccess', 'showDanger', 'reload'],
  data () {
    return {
      addedShopName: '',
      shops: [],
      shop: {
        name: '',
      },
      token: null,
      isLoadingShops: false
    }
  },
  methods: {
    selectShop (option) {
      this.shop = option
    },
    fetchShops () {
      this.isLoadingShops = true
      this.shops = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/shops', {
        cancelToken: this.token.token,
        params: { query: this.addedShopName, limit: 30 }
      }).then((response) => {
        this.shops = response.data.data

        this.isLoadingShops = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingShops = false
        this.showDanger('Could not fetch shops: ' + err.message)
      })
    },
    saveShop (shop) {
      this.isLoading = true
      if (shop) {
        this.event.shop_id = shop.id
      } else {
        this.event.shop_id = null
      }

      this.axios.put(this.services['alastair'] + '/events/' + this.event.id, { event: this.event }).then((response) => {
        this.showSuccess('Shop was saved.')

        this.isLoading = false
        this.$parent.close()
        this.reload()
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) this.ingredientErrors = err.response.data.errors

        this.showDanger(message)
      })
    }
  }
}
</script>