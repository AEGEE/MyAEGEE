<template>
<div class="content has-text-centered confirm-block">
  <div class="columns is-vcentered">
    <div class="column is-6 is-offset-3">
      <div class="box">
        <form v-on:submit.prevent="confirmPassword">
          <div class="field">
            <label class="label">Token</label>
            <div class="control">
              <input v-model="token" required class="input" type="text" placeholder="Type the token you've received by your email.">
            </div>
             <p class="help is-danger" v-if="errors.token">{{ errors.token.join(', ') }}</p>
          </div>

          <password-toggle v-model="password" requiired placeholder="Type your new password." label="Password">
            <template slot="errors-slot">
              <p class="help is-danger" v-if="errors.password">{{ errors.password.join(', ')}}</p>
            </template>
          </password-toggle>

          <password-toggle v-model="password_confirmation" requiired placeholder="Confirm your password." label="Password confirmation" />

          <hr />
          <p class="control">
            <button type="submit" class="button is-primary">Confirm password</button>
            <router-link :to="{ name: 'oms.password_reset' }" class="button">I don't have a token</router-link>
          </p>
        </form>
      </div>

      <div class="notification is-info">
        Please make up your mind for a second why a
        <a href="https://howsecureismypassword.net/" target="_blank">strong password</a>
        is a good idea. We recommend a
        <a href="https://padlock.io/" target="_blank">password manager.</a>
      </div>
    </div>
  </div>
</div>
</template>

<script>

import { mapGetters } from 'vuex'

export default {
  name: 'PasswordConfirm',
  data () {
    return {
      token: '',
      password: '',
      password_confirmation: '',
      errors: {}
    }
  },
  computed: mapGetters(['services']),
  methods: {
    confirmPassword () {
      this.errors = {}

      if (this.password !== this.password_confirmation) {
        this.errors.password = ['Password do not match.']
        return
      }

      this.axios.post(this.services['oms-core-elixir'] + '/confirm_reset_password/' + this.token, {
        password: this.password
      }).then((res) => {
        this.$root.showSuccess('Password is changed.')
        this.$router.push({ name: 'oms.login' })
      }).catch((err) => {
        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the password data is invalid.')
        }

        if (err.response.status === 404) {
          return this.$root.showError('Your token is invalid.')
        }

        this.$root.showError('Could not change password', err)
      })
    }
  },
  mounted () {
    if (this.$route.query.token) {
      this.token = this.$route.query.token
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-block {
  width: 100%
}
</style>
