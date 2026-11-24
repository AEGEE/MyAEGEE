<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <h1 class="title" id="category-edit-title">{{ $route.params.id ? 'Edit category' : 'Create category' }}</h1>

      <form @submit.prevent="saveCategory()" aria-labelledby="category-edit-title" :aria-busy="isLoading">
        <div class="field">
          <label class="label" for="category-name">Name</label>
          <div class="control">
            <input class="input" id="category-name" type="text" required v-model="category.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <h2 class="title">Discounts</h2>

        <div class="subtitle" v-if="category.discounts.length === 0">You didn't add any discounts.</div>

        <fieldset v-for="(discount, index) in category.discounts" v-bind:key="index">
          <legend class="label">Discount {{ index + 1 }}</legend>

          <div class="field">
            <label class="label" :for="'discount-' + index + '-name'">Name</label>
            <div class="control">
              <input class="input" :id="'discount-' + index + '-name'" type="text" required v-model="discount.name" />
            </div>
          </div>

          <div class="field">
            <label class="label" :for="'discount-' + index + '-icon'">Icon</label>
            <div class="control">
              <input class="input" :id="'discount-' + index + '-icon'" :aria-describedby="'discount-' + index + '-icon-help'" type="text" required v-model="discount.icon" />
            </div>
            <p class="help" :id="'discount-' + index + '-icon-help'">fa-something without the fa- prefix, check out <a href="https://fontawesome.com/v5/icons">this list</a> for icons</p>
          </div>

          <div class="field">
            <label class="label" :for="'discount-' + index + '-short'">Description (short)</label>
            <div class="control">
              <input class="input" :id="'discount-' + index + '-short'" type="text" required v-model="discount.shortDescription" />
            </div>
          </div>

          <div class="field">
            <label class="label" :for="'discount-' + index + '-long'">Description (long)</label>
            <div class="control">
              <textarea class="textarea" :id="'discount-' + index + '-long'" placeholder="e.g. Hello world" required v-model="discount.longDescription" />
            </div>
            <p class="label"><span :id="'discount-' + index + '-preview'">Preview</span> <MarkdownTooltip /></p>
            <div class="content" role="region" :aria-labelledby="'discount-' + index + '-preview'">
              <span v-html="$options.filters.markdown(discount.longDescription)" />
            </div>
          </div>

          <div class="control">
            <button type="button" class="button is-danger is-fullwidth" @click="deleteDiscount(index)">Delete discount</button>
          </div>
          <hr />
        </fieldset>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="buttons">
          <button type="button" class="button is-primary" @click="addDiscount()">Add new discount</button>
          <input type="submit" value="Save category" :disabled="isSaving" class="button is-primary" />
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MarkdownTooltip
  },
  name: 'EditCategory',
  data () {
    return {
      category: {
        name: '',
        discounts: []
      },
      permissions: [],
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    addDiscount () {
      this.category.discounts.push({
        name: '',
        icon: '',
        shortDescription: '',
        longDescription: ''
      })
    },
    deleteDiscount (index) {
      this.category.discounts.splice(index, 1)
    },
    saveCategory () {
      if (this.category.discounts.length === 0) {
        return this.$root.showError('Please add at least 1 discount for this category.')
      }

      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.services['discounts'] + '/categories/' + this.$route.params.id, this.category)
        : this.axios.post(this.services['discounts'] + '/categories/', this.category)

      promise.then(() => {
        this.isSaving = false

        this.$root.showSuccess('Category is saved.')

        return this.$router.push({ name: 'oms.discounts.categories.list' })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the category data is invalid.')
        }

        this.$root.showError('Could not save category', err)
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new category
    }

    this.isLoading = true
    this.axios.get(this.services['discounts'] + '/categories/' + this.$route.params.id).then((response) => {
      this.category = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Category is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.discounts.categories.list' })
    })
  }
}
</script>
