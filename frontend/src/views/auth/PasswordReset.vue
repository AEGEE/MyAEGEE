<template>
<div class="content has-text-centered confirm-block">
  <div class="columns is-vcentered">
    <div class="column is-6 is-offset-3">
      <div class="box">
        <form v-on:submit.prevent="resetPassword">
          <div class="field">
            <label class="label">Email</label>
            <div class="control">
              <input v-model="email" data-cy="email" required class="input" type="text" placeholder="Type the email you've registered with.">
            </div>
             <p class="help is-danger" v-if="error">{{ error }}</p>
          </div>

          <hr />
          <p class="control">
            <button type="submit" class="button is-primary">Reset password</button>
            <router-link :to="{ name: 'oms.password_confirm' }" class="button">Confirm password</router-link>
          </p>
        </form>
      </div>
    </div>
  </div>
</div>
</template>

<script>

import { mapGetters } from 'vuex'

export default {
  name: 'PasswordReset',
  data () {
    return {
      email: '',
      error: ''
    }
  },
  computed: mapGetters(['services']),
  methods: {
    resetPassword () {
      this.error = ''

      this.axios.post(this.services['oms-core-elixir'] + '/password_reset', {
        email: this.email
      }).then(() => {
        this.$root.showSuccess('Password reset triggered. Check your email.')
        this.$router.push({ name: 'oms.password_confirm' })
      }).catch((err) => {
        if (err.response.status === 404) {
          return this.$root.showError('Could not find this email.')
        }

        this.$root.showError('Could not reset password', err)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-block {
  width: 100%
}
</style>
