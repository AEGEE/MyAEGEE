<template>
  <div class='tile is-ancestor discounts'>
    <div class='tile is-parent is-vertical'>
      <section v-for="block in categories" v-bind:key="block.name">
        <div class="title">{{ block.name }}</div>

        <div class="collapse is-fullwidth">
          <div class="discounts-item" v-for="discount in block.discounts" v-bind:key="discount.name">
            <div class="card collapse-item" :class="{ 'is-active' : discount.expanded }">
              <header role="tab" class="card-header touchable" @click="discount.expanded = !discount.expanded">
                <div class="card-header-icon">
                  <i class="fa" :class="discount.icon" />
                </div>
                <div class="card-header-title">
                  <span> {{ discount.name }}: <span class="not-bold">{{ discount.shortDescription }}</span></span>
                </div>
                <span class="card-header-icon">
                  <i class="fa fa-angle-down" v-show="discount.expanded"></i>
                  <i class="fa fa-angle-up" v-show="!discount.expanded"></i>
                </span>
              </header>
              <div class="card-content" v-show="discount.expanded">
                <div class="card-content-box" v-html="$options.filters.markdown(discount.longDescription)"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <router-link class="button is-primary" :to="{ name: 'oms.discounts.my_discounts' }">My codes</router-link>
        <router-link  v-if="can.create" class="button is-primary" :to="{ name: 'oms.discounts.categories.list' }">Manage</router-link>
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

.discounts .card-header {
  cursor: pointer;
}
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  data () {
    return {
      can: {
        create: false
      },
      categories: []
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-discounts'] + '/categories').then((response) => {
      for (const category of response.data.data) {
        for (const discount of category.discounts) {
          discount.expanded = false
        }
      }

      this.categories = response.data.data

      return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data

      this.can.create = this.permissions.some(permission => permission.combined.endsWith('manage:discounts'))
      this.isLoading = false
    }).catch((err) => {
      this.$root.showError('Could not fetch categories list', err)
    })
  }
}
</script>
