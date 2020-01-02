<template>
  <div class="modal-card">
    <span v-if="permissions.shop_admin">
      <header class="modal-card-head">
        <p class="modal-card-title" v-if="isNewShop">New shop</p>
        <p class="modal-card-title" v-if="!isNewShop">Edit Shop</p>
        <button class="delete" aria-label="close" @click="$parent.close()"></button>
      </header>
      <section class="modal-card-body">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="shop.name" />
          </div>
          <p class="help is-danger" v-if="shopErrors.name">{{ shopErrors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Location</label>
          <div class="control">
            <input class="input" type="text" required v-model="shop.location" />
          </div>
          <p class="help is-danger" v-if="shopErrors.location">{{ shopErrors.location.join(', ')}}</p>
        </div>

        <div class="field has-addons">
          <label class="label">Currency</label>
          <b-autocomplete
            v-model="addedCurrencyName"
            :data="currencies"
            field="name"
            :loading="isLoadingCurrencies"
            @input="fetchCurrencies"
            expanded="true"
            @select="option => selectCurrency(option)">

            <template slot-scope="props">
              <div class="media">
                <div class="media-content">{{ props.option.name }}</div>
              </div>
            </template>
          </b-autocomplete>

          <p class="control">
            <a class="button is-danger"
              @click="selectCurrency(null)"
              v-if="shop.currency">{{ shop.currency.name }} (Click to unset)</a>
            <a class="button is-static" v-if="!shop.currency">Not set.</a>
          </p>
          
          <p class="help is-danger" v-if="shopErrors.currency">{{ shopErrors.currency.join(', ')}}</p>
          <p class="help is-danger" v-if="shopErrors.currency_id">{{ shopErrors.currency_id.join(', ')}}</p>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-primary" @click="saveShop()">Save changes</button>
        <button class="button is-danger" @click="askDeleteShop()" v-show="!isNewShop">Delete Shop</button>
        <button class="button" @click="$parent.close()">Cancel</button>
      </footer>
    </span>
    <span v-if="!permissions.shop_admin">
      <header class="modal-card-head">
        <p class="modal-card-title">Edit Shop</p>
      </header>
      <section class="modal-card-body">
        <p class="title">You are not a shop-admin</p>
        <p class="subtitle">Please ask a shop-admin to make the changes you need</p>
      </section>
    </span>
  </div>
</template>

<script>
export default {
  name: 'ShopEditModal',
  props: ['shop', 'isNewShop', 'services', 'showSuccess', 'showError', 'reload'],
  data () {
    return {
      shopErrors: {},
      addedCurrencyName: '',
      currencies: [],
      token: null,
      isLoadingCurrencies: false,
      permissions: {
        shop_admin: true
      }
    }
  },
  methods: {
    askDeleteShop () {
      this.$buefy.dialog.confirm({
        title: 'Deleting an shop',
        message: `Are you sure you want to <b>delete this shop</b>?`,
        confirmText: 'Delete shop',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteShop()
      })
    },
    deleteShop () {
      this.axios.delete(this.services['alastair'] + '/shops/' + this.shop.id).then((response) => {
        this.showSuccess('Shop is deleted.')
        this.$parent.close()
        this.reload()
      }).catch((err) => this.showError('Could not delete shop', err))
    },
    selectCurrency (option) {
      console.log(option)
      this.shop.currency = option
      this.shop.currency_id = option.id
    },
    fetchCurrencies () {
      this.isLoadingCurrencies = true
      this.currencies = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['alastair'] + '/currencies', {
        cancelToken: this.token.token,
        params: { query: this.addedCurrencyName }
      }).then((response) => {
        this.currencies = response.data.data

        this.isLoadingCurrencies = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingCurrencies = false
        this.showError('Could not fetch currencies', err)
      })
    },
    saveShop () {
      this.isLoading = true
      let promise = null
      if (this.isNewShop) {
        promise = this.axios.post(this.services['alastair'] + '/shops/', { shop: this.shop })
      } else {
        promise = this.axios.put(this.services['alastair'] + '/shops/' + this.shop.id, { shop: this.shop })
      }

      promise.then((response) => {
        this.showSuccess('Shop was saved.')

        this.isLoading = false
        this.$parent.close()
        this.reload()
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }

        if (err.response && err.response.data && err.response.data.errors) this.shopErrors = err.response.data.errors
      })
    }
  },
  mounted () {
    if (this.isNewShop) {
      return
    }

    this.axios.get(this.services['alastair'] + '/shops/' + this.shop.id + '/user').then((response) => {
      this.permissions = response.data.data
    }).catch((err) => {
      this.showError('Could not fetch shop details', err)
    })
  }
}
</script>