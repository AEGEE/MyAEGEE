<template>
  <div class='tile is-ancestor discounts'>
    <div class='tile is-parent is-vertical'>
      <section v-for="(block, blockIndex) in categories" v-bind:key="block.name" :aria-labelledby="'discounts-category-' + blockIndex">
        <h2 class="title" :id="'discounts-category-' + blockIndex">{{ block.name }}</h2>

        <div class="collapse is-fullwidth">
          <div class="discounts-item" v-for="(discount, discountIndex) in block.discounts" v-bind:key="discount.name">
            <div class="card collapse-item" :class="{ 'is-active': discount.expanded }">
              <header class="card-header">
                <button
                  type="button"
                  class="card-header-toggle touchable"
                  :aria-expanded="discount.expanded ? 'true' : 'false'"
                  :aria-controls="'discount-' + blockIndex + '-' + discountIndex"
                  @click="discount.expanded = !discount.expanded">
                  <span class="card-header-icon">
                    <font-awesome-icon :icon="['fa', discount.icon]" />
                  </span>
                  <span class="card-header-title">
                    <span> {{ discount.name }}: <span class="not-bold">{{ discount.shortDescription }}</span></span>
                  </span>
                  <span class="card-header-icon">
                    <font-awesome-icon :icon="['fa', discount.expanded ? 'angle-down' : 'angle-up']" />
                  </span>
                </button>
              </header>
              <div class="card-content" :id="'discount-' + blockIndex + '-' + discountIndex" v-show="discount.expanded">
                <div class="card-content-box" v-html="$options.filters.markdown(discount.longDescription)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="buttons">
        <router-link class="button is-primary" :to="{ name: 'oms.discounts.my_discounts' }">My codes</router-link>
        <router-link v-if="can.create" class="button is-primary" :to="{ name: 'oms.discounts.categories.list' }">Manage discounts</router-link>
        <router-link v-if="can.create" class="button is-primary" :to="{ name: 'oms.discounts.list' }">Manage codes</router-link>
      </section>
    </div>
  </div>
</template>

<style>
.discounts .discounts-item:last-child {
  margin-bottom: 50px;
}
.discounts .discounts-item .card-header-icon {
  width: 48px;
  text-align: center;
}
.discounts .not-bold {
  font-weight: normal;
}

/* A button, so the keyboard reaches it, that looks like the card's header. */
.discounts .card-header-toggle {
  display: flex;
  align-items: stretch;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  data () {
    return {
      categories: []
    }
  },
  computed: {
    // The same check as the discounts service's: a permission that ends in manage:discounts.
    can () {
      return {
        create: this.permissions.some(permission => permission.combined.endsWith('manage:discounts'))
      }
    },
    ...mapGetters(['services', 'permissions'])
  },
  mounted () {
    this.axios.get(this.services['discounts'] + '/categories').then((response) => {
      for (const category of response.data.data) {
        for (const discount of category.discounts) {
          discount.expanded = false
        }
      }

      this.categories = response.data.data
    }).catch((err) => {
      this.$root.showError('Could not fetch categories list', err)
    })
  }
}
</script>
