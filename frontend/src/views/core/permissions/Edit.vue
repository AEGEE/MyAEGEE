<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <h1 class="title">{{ $route.params.id ? 'Edit permission' : 'Create permission' }}</h1>

      <form @submit.prevent="savePermission()">
        <div class="field">
          <label class="label" for="permission-scope">Scope</label>
          <div class="control">
            <div class="select">
              <select id="permission-scope" v-model="permission.scope">
                <option value="global">Global</option>
                <option value="local">Local</option>
                <option value="join_request">Join request</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.scope">{{ errors.scope.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="permission-action">Action</label>
          <div class="control">
            <input id="permission-action" class="input" type="text" required v-model="permission.action" />
          </div>
          <p class="help is-danger" v-if="errors.action">{{ errors.action.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="permission-object">Object</label>
          <div class="control">
            <input id="permission-object" class="input" type="text" required v-model="permission.object" />
          </div>
          <p class="help is-danger" v-if="errors.object">{{ errors.object.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="permission-description">Description</label>
          <div class="control">
            <input id="permission-description" class="input" type="text" required v-model="permission.description" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Filters</label>
          <div class="control">
            <span v-for="(filter, index) in permission.filters" v-bind:key="filter" class="tag is-info">
              {{ filter }}
              <button type="button" class="delete is-small" :aria-label="'Remove filter ' + filter" @click="deleteFilter(index)" />
            </span>
            <span v-if="permission.filters.length === 0" class="tag is-light">No filters set.</span>
          </div>
        </div>

        <div class="field has-addons">
          <div class="control">
            <input class="input" type="text" aria-label="New filter" v-model="tmpFilter" @keydown.enter.prevent="addFilter()" />
          </div>
          <div class="control">
            <button type="button" class="button is-primary" :disabled="tmpFilter.length === 0" @click="addFilter()">Add filter</button>
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save permission" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import pick from 'lodash/pick'

export default {
  name: 'EditPermission',
  data () {
    return {
      permission: {
        action: '',
        scope: 'global',
        object: null,
        filters: []
      },
      errors: {},
      isLoading: false,
      isSaving: false,
      tmpFilter: ''
    }
  },
  methods: {
    savePermission () {
      this.isSaving = true
      this.errors = {}

      // What can be set: not the code made of the three parts, or the circles.
      const body = pick(this.permission, ['scope', 'action', 'object', 'description', 'filters'])

      const promise = this.$route.params.id
        ? this.axios.put(this.services['core'] + '/permissions/' + this.$route.params.id, body)
        : this.axios.post(this.services['core'] + '/permissions/', body)

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Permission is saved.')

        return this.$router.push({
          name: 'oms.permissions.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the permission data is invalid.')
        }

        this.$root.showError('Could not save permission', err)
      })
    },
    deleteFilter (index) {
      this.permission.filters.splice(index, 1)
    },
    addFilter () {
      if (!this.tmpFilter) return

      this.permission.filters.push(this.tmpFilter)
      this.tmpFilter = ''
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true
    this.axios.get(this.services['core'] + '/permissions/' + this.$route.params.id).then((response) => {
      this.permission = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Permission is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.permissions.list' })
    })
  }
}
</script>
