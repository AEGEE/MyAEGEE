<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Discounts categories list</h4>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.discounts.categories.create' }">Create category</router-link>
          </div>
        </div>

        <b-table :data="categories" :loading="isLoading" narrowed>
          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column field="discounts" label="Discounts" v-slot="props">
            <ul v-for="(discount, index) in props.row.discounts" v-bind:key="index">
              <li>{{ discount.name }}</li>
            </ul>
          </b-table-column>

          <b-table-column label="Edit" v-slot="props">
            <router-link :to="{ name: 'oms.discounts.categories.edit', params: { id: props.row.id } }" class="button is-small is-warning">Edit</router-link>
          </b-table-column>

          <b-table-column label="Delete" v-slot="props">
            <button @click="askDeleteCategory(props.index)" class="button is-small is-danger">Delete</button>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'CategoriesList',
  data () {
    return {
      categories: [],
      isLoading: false,
      permissions: [],
      can: {
        create: false
      }
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    askDeleteCategory (index) {
      this.$buefy.dialog.confirm({
        title: 'Delete a category',
        message: 'Are you sure you want to <b>delete</b> this category? This action cannot be undone.',
        confirmText: 'Delete category',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteCategory(index)
      })
    },
    deleteCategory (index) {
      this.axios.delete(this.services['discounts'] + '/categories/' + this.categories[index].id).then(() => {
        this.$root.showSuccess('Category is deleted.')
        this.categories.splice(index, 1)
      }).catch((err) => this.$root.showError('Could not delete category', err))
    },
    refetch () {
      this.integrations = []
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['discounts'] + '/categories').then((response) => {
        this.categories = response.data.data

        return this.axios.get(this.services['core'] + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.create = this.permissions.some(permission => permission.combined.endsWith('manage:discounts'))
        this.isLoading = false
      }).catch((err) => {
        this.$root.showError('Could not fetch categories list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
