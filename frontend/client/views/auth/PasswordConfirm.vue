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

          <div class="field">
            <label class="label">Password</label>
            <div class="control">
              <input v-model="password" required class="input" type="password" placeholder="Type your new password.">
            </div>
             <p class="help is-danger" v-if="errors.password">{{ errors.password.join(', ') }}</p>
          </div>

          <div class="field">
            <label class="label">Password confirmation</label>
            <div class="control">
              <input v-model="password_confirmation" required class="input" type="password" placeholder="Confirm your password.">
            </div>
          </div>

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
        this.$toast.open({
          duration: 3000,
          message: 'Password is changed.',
          type: 'is-success'
        })
        this.$router.push({ name: 'oms.login' })
      }).catch((err) => {
        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the password data is invalid.',
            type: 'is-danger'
          })
        }

        if (err.response.status === 404) {
          return this.$toast.open({
            duration: 3000,
            message: 'Your token is invalid.',
            type: 'is-danger'
          })
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not change password: ' + err.message,
          type: 'is-danger'
        })
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
