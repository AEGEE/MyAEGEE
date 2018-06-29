<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="savePermission()">
        <div class="field">
          <label class="label">Scope</label>
          <div class="control">
            <input class="input" type="text" required v-model="permission.scope" />
          </div>
          <p class="help is-danger" v-if="errors.scope">{{ errors.scope.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Action</label>
          <div class="control">
            <input class="input" type="text" required v-model="permission.action" />
          </div>
          <p class="help is-danger" v-if="errors.action">{{ errors.action.join(', ')}}</p>
        </div>


        <div class="field">
          <label class="label">Object</label>
          <div class="control">
            <input class="input" type="text" required v-model="permission.object" />
          </div>
          <p class="help is-danger" v-if="errors.object">{{ errors.object.join(', ')}}</p>
        </div>


        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <input class="input" type="text" v-model="permission.description" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Always assigned?
            <input type="checkbox" v-model="permission.always_assigned" />
          </label>
          <p class="help is-danger" v-if="errors.always_assigned">{{ errors.always_assigned.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Filters</label>
          <div class="control">
            <span v-if="permission.filters.length > 0" v-for="(filter, index) in permission.filters" v-bind:key="filter.field" class="tag is-info">
              {{ filter.field }}
              <button class="delete is-small" @click="deleteFilter(index)"></button>
            </span>
            <span v-if="permission.filters.length === 0" class="tag is-light">No filters set.</span>
          </div>
        </div>

        <div class="field has-addons">
          <div class="control">
            <input class="input" type="text" v-model="tmpFilter" />
          </div>
          <div class="control">
            <a class="button is-primary" @click.prevent="addFilter()" :disabled="tmpFilter.length === 0">Add filter</a>
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save permission" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import services from '../../../services.json'

export default {
  name: 'EditPermission',
  data () {
    return {
      permission: {
        action: '',
        scope: '',
        object: null,
        always_assigned: false,
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

      const promise = this.$route.params.id
        ? this.axios.put(services['oms-core-elixir'] + '/permissions/' + this.$route.params.id, { permission: this.permission })
        : this.axios.post(services['oms-core-elixir'] + '/permissions/', { permission: this.permission })

      promise.then((response) => {
        this.isSaving = false

        this.$toast.open({
          duration: 3000,
          message: 'Permission is saved.',
          type: 'is-success'
        })

        return this.$router.push({
          name: 'oms.permissions.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the permission data is invalid.',
            type: 'is-danger'
          })
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not save permission: ' + err.message,
          type: 'is-danger'
        })
      })
    },
    deleteFilter (index) {
      this.permission.filters.splice(index, 1)
    },
    addFilter (index) {
      this.permission.filters.push({ field: this.tmpFilter })
      this.tmpFilter = ''
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return
    }

    this.isLoading = true
    this.axios.get(services['oms-core-elixir'] + '/permissions/' + this.$route.params.id).then((response) => {
      this.permission = response.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Permission is not found' : 'Some error happened: ' + err.message

      this.$toast.open({
        duration: 3000,
        message,
        type: 'is-danger'
      })
      this.$router.push({ name: 'oms.permissions.list' })
    })
  }
}
</script>
