<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveUser()">
        <password-toggle v-model="old_password" :required="false" placeholder="Your old password." label="Old password">
          <template slot="errors-slot">
            <p class="help is-danger" v-if="errors.old_password">{{ errors.old_password.join(', ')}}</p>
          </template>
        </password-toggle>

        <password-toggle v-model="user.password" :required="false" placeholder="Type in your password." label="New password">
          <template slot="errors-slot">
            <p class="help is-danger" v-if="errors.password">{{ errors.password.join(', ')}}</p>
          </template>
        </password-toggle>

        <password-toggle v-model="password_confirmation" :required="false" placeholder="Confirm your password." label="Confirm your password">
          <template slot="errors-slot">
            <p class="help is-danger" v-if="errors.password_confirmation">{{ errors.password_confirmation.join(', ')}}</p>
          </template>
        </password-toggle>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save user" :disabled="isSaving" class="button is-primary is-fullwidth" />
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

      const body = {
        old_password: this.old_password,
        password: this.user.password
      }

      this.isSaving = true
      this.axios.put(this.services['core'] + '/members/me/password', body).then(() => {
        this.isSaving = false

        this.$root.showSuccess('Password is updated.')

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

          return this.$root.showError('Some of the user data is invalid.')
        }

        this.$root.showError('Could not save user', err)
      })
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.axios.get(this.services['core'] + '/members/me').then((response) => {
      this.user = response.data.data
      this.user.password = ''
      this.isLoading = false
    }).catch((err) => {
      this.$root.showError('Some error happened', err)
      this.$router.push({ name: 'oms.members.list' })
    })
  }
}
</script>
