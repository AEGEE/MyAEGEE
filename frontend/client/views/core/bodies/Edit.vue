<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveBody()">
        <div class="field">
          <label class="label">Type</label>
          <div class="control">
            <div class="select">
              <select v-model="body.type" :disabled="!can.editType" >
                <option value="antenna">Antenna</option>
                <option value="contact antenna">Contact antenna</option>
                <option value="contact">Contact</option>
                <option value="interest group">Interest group</option>
                <option value="working group">Working group</option>
                <option value="commission">Commission</option>
                <option value="committee">Comittee</option>
                <option value="project">Project</option>
                <option value="partner">Partner association</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.scope">{{ errors.scope.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required :disabled="!can.editName" v-model="body.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="body.description"></textarea>
          </div>
          <label class="label">Preview</label>
          <div class="content">
            <span v-html="$options.filters.markdown(body.description)">
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.message }}</p>
        </div>

        <div class="field">
          <label class="label">Body code</label>
          <div class="control">
            <input class="input" type="text" required :disabled="!can.editCode" v-model="body.legacy_key" />
          </div>
          <p class="help is-danger" v-if="errors.legacy_key">{{ errors.legacy_key.join(', ')}}</p>
        </div>


        <div class="field">
          <label class="label">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="text" required v-model="body.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-phone"></i></span>
            <input class="input" type="text" v-model="body.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Address</label>
          <div class="control">
            <input class="input" type="text" required v-model="body.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field" v-if="$route.params.id && can.editShadowCircle">
          <label class="label">Shadow circle</label>
          <p class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autocompleteBody"
                :data="filteredShadowCircles"
                :disabled="!can.editShadowCircle"
                open-on-focus="true"
                @select="circle => { body.shadow_circle_id = circle.id; body.shadow_circle = circle }">
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
              <p class="control" v-if="can.editShadowCircle">
                <a class="button is-danger"
                  @click="body.shadow_circle_id = null; body.shadow_circle = null"
                  v-if="body.shadow_circle">{{ body.shadow_circle.name }} (Click to unset)</a>
                <a class="button is-static" v-if="!body.shadow_circle">Not set.</a>
              </p>
              <p class="control" v-if="!can.editShadowCircle">
                <a class="button is-static" v-if="body.shadow_circle">{{ body.shadow_circle.name }}</a>
                <a class="button is-static" v-if="!body.shadow_circle">Not set.</a>
              </p>
            </div>
          <p class="help is-danger" v-if="errors.shadow_circle_id">{{ errors.shadow_circle_id.join(', ')}}</p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save body" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditBody',
  data () {
    return {
      body: {
        name: '',
        description: '',
        id: null,
        legacy_key: null,
        email: null,
        phone: null,
        address: null,
        shadow_circle_id: null,
        shadow_circle: null,
        circles: []
      },
      permissions: [],
      can: {
        editName: true,
        editCode: true,
        editShadowCircle: true,
        editType: true
      },
      autocompleteBody: '',
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services']),
    filteredShadowCircles () {
      return this.body.circles.filter(circle => circle.name.toLowerCase().includes(this.autocompleteBody.toLowerCase()))
    }
  },
  methods: {
    saveBody () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id, { body: this.body })
        : this.axios.post(this.services['oms-core-elixir'] + '/bodies/', { body: this.body })

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Body is saved.')

        return this.$router.push({
          name: 'oms.bodies.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the body data is invalid.')
        }

        this.$root.showDanger('Could not save body: ' + err.message)
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new body
    }

    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id).then((response) => {
      this.body = response.data.data
      this.isLoading = false

      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data

      const editGlobalPermission = this.permissions.find(permission => permission.combined.endsWith('global:update:body'))
      this.can.editName = editGlobalPermission
      this.can.editCode = editGlobalPermission
      this.can.editShadowCircle = editGlobalPermission
      this.can.editType = editGlobalPermission
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Body is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.bodies.list' })
    })
  }
}
</script>
