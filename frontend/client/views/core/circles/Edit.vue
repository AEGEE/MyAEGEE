<template>
  <div class="tile is-ancestor ">
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
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

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
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    saveCircle () {
      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id, { circle: this.circle })
        : this.axios.post(this.services['oms-core-elixir'] + '/circles/', { circle: this.circle })

      promise.then((response) => {
        this.isSaving = false

        this.$toast.open({
          duration: 3000,
          message: 'Circle is saved.',
          type: 'is-success'
        })

        return this.$router.push({
          name: 'oms.circles.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the circle data is invalid.',
            type: 'is-danger'
          })
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not save circle: ' + err.message,
          type: 'is-danger'
        })
      })
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

      this.$toast.open({
        duration: 3000,
        message,
        type: 'is-danger'
      })
      this.$router.push({ name: 'oms.circles.list' })
    })
  }
}
</script>
