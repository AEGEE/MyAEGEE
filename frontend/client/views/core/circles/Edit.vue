<template>
  <div class="tile is-ancestor is-vertical">
    <div class="tile is-child">
      <form @submit.prevent="saveCircle()">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="circle.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <input class="input" type="text" required v-model="circle.description" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Joinable?
            <input type="checkbox" class="checkbox" v-model="circle.joinable"/>
          </label>
          <p class="help is-danger" v-if="errors.joinable">{{ errors.joinable.join(', ')}}</p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save circle" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>

    <hr/>

    <div class="tile is-child" v-if="$route.params.id">
      <div class="field">
        <label class="label">Parent circle</label>
        <div class="control">
          <div class="field has-addons">
            <b-autocomplete
              v-model="autoComplete.parentCircle.name"
              :data="autoComplete.parentCircle.values"
              open-on-focus="true"
              :loading="autoComplete.parentCircle.loading"
              @input="query => fetchSomething(query, 'parentCircle', 'circles')"
              @select="childCircle => setParentCircle(childCircle)">
              <template slot-scope="props">
                <div class="media">
                  <div class="media-content">
                      {{ props.option.name }}
                      <br>
                      <small> {{ props.option.description }} </small>
                  </div>
                </div>
              </template>
            </b-autocomplete>
            <p class="control">
              <a class="button is-danger"
                @click="setParentCircle(null)"
                v-if="circle.parent_circle">{{ circle.parent_circle.name }} (Click to unset)</a>
              <a class="button is-static" v-if="!circle.parent_circle">Not set.</a>
            </p>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Child circles</label>
        <ul>
          <li v-for="childCircle in circle.child_circles" v-bind:key="childCircle.id">
            <span class="tag is-danger">{{ childCircle.name }}
              <button class="delete is-small" @click="toggleChildCircle(childCircle, false)"></button>
            </span>
          </li>
          <li v-if="circle.child_circles.length === 0">
            <i>No child circles attached.</i>
          </li>
        </ul>
      </div>

      <div class="field">
        <label class="label">Add child circle</label>
        <div class="control">
          <div class="field has-addons">
            <b-autocomplete
              v-model="autoComplete.childCircles.name"
              :data="autoComplete.childCircles.values"
              open-on-focus="true"
              :loading="autoComplete.childCircles.loading"
              @input="query => fetchSomething(query, 'childCircles', 'circles')"
              @select="childCircle => toggleChildCircle(childCircle, true)">
              <template slot-scope="props">
                <div class="media">
                  <div class="media-content">
                      {{ props.option.name }}
                      <br>
                      <small> {{ props.option.description }} </small>
                  </div>
                </div>
              </template>
            </b-autocomplete>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">Attached permissions</label>
        <ul>
          <li v-for="permission in circle.permissions" v-bind:key="permission.id">
            <span class="tag is-danger">{{ permission.combined }}
              <button class="delete is-small" @click="togglePermission(permission, false)"></button>
            </span>
          </li>
          <li v-if="circle.permissions.length === 0">
            <i>No permissions attached.</i>
          </li>
        </ul>
      </div>

      <div class="field">
        <label class="label">Add permission</label>
        <div class="control">
          <div class="field has-addons">
            <b-autocomplete
              v-model="autoComplete.permissions.name"
              :data="autoComplete.permissions.values"
              open-on-focus="true"
              :loading="autoComplete.permissions.loading"
              @input="query => fetchSomething(query, 'permissions', 'permissions')"
              @select="permission => togglePermission(permission, true)">
              <template slot-scope="props">
                <div class="media">
                  <div class="media-content">
                      {{ props.option.combined }}
                      <br>
                      <small> {{ props.option.description }} </small>
                  </div>
                </div>
              </template>
            </b-autocomplete>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditCircle',
  data () {
    return {
      circle: {
        name: '',
        description: '',
        id: null,
        child_circles: [],
        permissions: [],
        body: null,
        body_id: null,
        parent_circle: null,
        parent_circle_id: null
      },
      autoComplete: {
        parentCircle: { name: '', values: [], loading: false },
        childCircles: { name: '', values: [], loading: false },
        permissions: { name: '', values: [], loading: false }
      },
      token: null,
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    fetchSomething (query, key, context) {
      if (!query) return

      this.autoComplete[key].values = []
      this.autoComplete[key].loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/' + context, {
        cancelToken: this.token.token,
        params: { query }
      }).then((response) => {
        this.autoComplete[key].values = response.data.data
        this.autoComplete[key].loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete[key].loading = false

        this.$root.showDanger('Could not fetch ' + context + 's: ' + err.message)
      })
    },
    setParentCircle (circle) {
      this.autoComplete.parentCircle.loading = true
      this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/parent', {
        parent_circle_id: circle ? circle.id : null
      }).then((response) => {
        this.autoComplete.parentCircle.loading = false
        this.circle.parent_circle = circle
        this.circle.parent_circle_id = circle ? circle.id : null

        this.$root.showSuccess('Parent circle is ' + (circle ? 'set.' : 'unset.'))
      }).catch((err) => {
        this.autoComplete.parentCircle.loading = false

        if (err.response.status === 422) {
          const errors = Object.keys(err.response.data.errors).map(key => err.response.data.errors[key].join(',')).join(',')
          return this.$root.showDanger('Could not ' + (circle ? 'set' : 'unset') + ' parent circle: ' + errors)
        }

        this.$root.showDanger('Could not ' + (circle ? 'set' : 'unset') + ' parent circle: ' + err.message)
      })
    },
    togglePermission (permission, add) {
      this.autoComplete.permissions.loading = true

      const permissionsBefore = JSON.parse(JSON.stringify(this.circle.permissions))

      if (add) {
        this.circle.permissions.push(permission)
      } else {
        const index = this.circle.permissions.findIndex(perm => perm.id === permission.id)
        this.circle.permissions.splice(index, 1)
      }

      this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/permissions', {
        permissions: this.circle.permissions
      }).then((response) => {
        this.autoComplete.permissions.loading = false

        this.$root.showSuccess('Permission is ' + (add ? 'added. ' : 'removed.'))
      }).catch((err) => {
        this.autoComplete.permissions.loading = false
        this.circle.permissions = permissionsBefore // reverting permissions list

        if (err.response.status === 422) {
          const errors = Object.keys(err.response.data.errors).map(key => err.response.data.errors[key].join(',')).join(',')
          return this.$root.showDanger('Could not ' + (add ? 'add' : 'remove') + ' permission: ' + errors)
        }

        this.$root.showDanger('Could not ' + (add ? 'add' : 'remove') + ' permission: ' + err.message)
      })
    },
    toggleChildCircle (circle, add) {
      this.autoComplete.childCircles.loading = true

      const circlesBefore = JSON.parse(JSON.stringify(this.circle.child_circles))

      if (add) {
        this.circle.child_circles.push(circle)
      } else {
        const index = this.circle.child_circles.findIndex(newCircle => newCircle.id === circle.id)
        this.circle.child_circles.splice(index, 1)
      }

      this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/children', {
        child_circles: this.circle.child_circles
      }).then((response) => {
        this.autoComplete.childCircles.loading = false

        this.$root.showSuccess('Child circle is ' + (add ? 'added. ' : 'removed.'))
      }).catch((err) => {
        this.autoComplete.childCircles.loading = false
        this.circle.child_circles = circlesBefore // reverting children list

        if (err.response.status === 422) {
          const errors =
            err.response.data.errors
              ? Object.keys(err.response.data.errors).map(key => err.response.data.errors[key].join(',')).join(',')
              : err.response.data.message
          return this.$root.showDanger('Could not ' + (add ? 'add' : 'remove') + ' child circle: ' + errors)
        }

        this.$root.showDanger('Could not ' + (add ? 'add' : 'remove') + ' child circle: ' + err.message)
      })
    },
    saveCircle () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id, { circle: this.circle })
        : this.axios.post(this.services['oms-core-elixir'] + '/circles/', { circle: this.circle })

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Circle is saved.')

        return this.$router.push({
          name: 'oms.circles.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the circle data is invalid.')
        }

        this.$root.showDanger('Could not save circle: ' + err.message)
      })
    },
    capitalize (value) {
      if (!value) return ''
      value = value.toString()
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new circle
    }

    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id).then((response) => {
      this.circle = response.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Circle is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.circles.list' })
    })
  }
}
</script>
