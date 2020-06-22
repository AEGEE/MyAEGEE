<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveCategory()">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="category.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="title">Discounts</div>

        <div class="subtitle" v-if="category.discounts.length === 0">You didn't add any discounts.</div>

        <div v-for="(discount, index) in category.discounts" v-bind:key="index">
          <div class="field">
            <label class="label">Name</label>
            <div class="control">
              <input class="input" type="text" required v-model="discount.name" />
            </div>
          </div>

          <div class="field">
            <label class="label">Icon (fa-something without the fa- prefix, check out <a href="https://fontawesome.com/icons">this list</a> for icons)</label>
            <div class="control">
              <input class="input" type="text" required v-model="discount.icon" />
            </div>
          </div>

          <div class="field">
            <label class="label">Description (short)</label>
            <div class="control">
              <input class="input" type="text" required v-model="discount.shortDescription" />
            </div>
          </div>

          <div class="field">
            <label class="label">Description (long), supports <a href="https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet">Markdown</a> for formatting</label>
            <div class="control">
              <textarea class="textarea" placeholder="e.g. Hello world" required v-model="discount.longDescription"></textarea>
            </div>
            <label class="label">Preview</label>
            <div class="content">
              <span v-html="$options.filters.markdown(discount.longDescription)" />
            </div>
          </div>

          <div class="control">
            <button class="button is-danger is-fullwidth" @click="deleteDiscount(index)">Delete discount</button>
          </div>
          <hr />
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="buttons">
          <button class="button is-primary" @click="addDiscount()">Add new discount</button>
          <input type="submit" value="Save category" :disabled="isSaving" class="button is-primary"/>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
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

        if (err.response.status === 422) { // validation errors
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
      if (err.response.status === 404) {
        this.$root.showError('Category is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.discounts.categories.list' })
    })
  }
}
</script>
