<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveBody()">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="body.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description</label>
          <div class="control">
            <input class="input" type="text" v-model="body.description" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Body code</label>
          <div class="control">
            <input class="input" type="text" required v-model="body.legacy_key" />
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

        <div class="field" v-if="$route.params.id">
          <label class="label">Shadow circle</label>
          <p class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autocompleteBody"
                :data="body.circles"
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
              <p class="control">
                <a class="button is-danger"
                  @click="body.shadow_circle_id = null; body.shadow_circle = null"
                  v-if="body.shadow_circle">{{ body.shadow_circle.name }} (Click to unset)</a>
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
import services from '../../../services.json'

export default {
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
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveBody () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(services['oms-core-elixir'] + '/bodies/' + this.$route.params.id, { body: this.body })
        : this.axios.post(services['oms-core-elixir'] + '/bodies/', { body: this.body })

      promise.then((response) => {
        this.isSaving = false

        this.$toast.open({
          duration: 3000,
          message: 'Body is saved.',
          type: 'is-success'
        })

        return this.$router.push({
          name: 'oms.bodies.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the body data is invalid.',
            type: 'is-danger'
          })
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not save body: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new body
    }

    this.isLoading = true
    this.axios.get(services['oms-core-elixir'] + '/bodies/' + this.$route.params.id).then((response) => {
      this.body = response.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Body is not found' : 'Some error happened: ' + err.message

      this.$toast.open({
        duration: 3000,
        message,
        type: 'is-danger'
      })
      this.$router.push({ name: 'oms.bodies.list' })
    })
  }
}
</script>
