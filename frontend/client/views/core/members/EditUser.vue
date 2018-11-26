<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveUser()">
        <div class="field">
          <label class="label">Username</label>
          <div class="control">
            <input
              class="input"
              type="text"
              required
              v-model="user.name"
              pattern="^[a-zA-Z0-9\.\-].$"
              title="Username can only contain English letters, numbers, dots and dashes."
              placeholder="You will be able to login with it." />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="email" v-model="user.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <hr />

        <div class="field">
          <label class="label">Old password</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="password" v-model="old_password" />
          </div>
          <p class="help is-danger" v-if="errors.old_password">{{ errors.old_password.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">New password</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="password" v-model="user.password" />
          </div>
          <p class="help is-danger" v-if="errors.password">{{ errors.password.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Password confirmation</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="password" v-model="password_confirmation" />
          </div>
          <p class="help is-danger" v-if="errors.password_confirmation">{{ errors.password_confirmation.join(', ')}}</p>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save user" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditUser',
  data () {
    return {
      user: {
        name: '',
        email: '',
        password: ''
      },
      errors: {},
      old_password: '',
      password_confirmation: '',
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveUser () {
      this.errors = {}

      if (this.user.password !== this.password_confirmation) {
        this.errors.password = ['Passwords do not match.']
        return
      }

      if ((this.user.password || this.password_confirmation) && !this.old_password) {
        this.errors.old_password = ['Please type in your old password']
        return
      }

      let obj = { user: {} }
      for (const key of Object.keys(this.user)) if (this.user[key]) obj.user[key] = this.user[key]
      if (this.user.password) {
        obj.old_password = this.old_password
        obj.user.old_password = this.old_password
        obj.user.password_copy = this.password_confirmation
      }

      this.isSaving = true
      this.axios.put(this.services['oms-core-elixir'] + '/user/', obj).then((response) => {
        this.isSaving = false

        this.$root.showSuccess('User is saved.')

        return this.$router.push({
          name: 'oms.members.view',
          params: { id: 'me' }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          if (!err.response.data.errors) { // incorrect old password
            this.errors = { old_password: ['Wrong password.'] }
          } else {
            this.errors = err.response.data.errors
          }

          return this.$root.showDanger('Some of the user data is invalid.')
        }

        this.$root.showDanger('Could not save user: ' + err.message)
      })
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.axios.get(this.services['oms-core-elixir'] + '/members/me').then((response) => {
      this.user = response.data.data.user
      this.user.password = ''
      this.isLoading = false
    }).catch((err) => {
      this.$root.showDanger('Some error happened: ' + err.message)
      this.$router.push({ name: 'oms.members.list' })
    })
  }
}
</script>
