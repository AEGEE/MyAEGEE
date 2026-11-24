<template>
  <div class="content has-text-centered confirm-block">
    <div class="columns is-vcentered">
      <div class="column is-6 is-offset-3">
        <div class="box">
          <form v-on:submit.prevent="resetPassword">
            <div class="field">
              <label class="label" for="password-reset-email">Email</label>
              <div class="control">
                <input
                  id="password-reset-email"
                  v-model="email"
                  required
                  class="input"
                  type="email"
                  placeholder="Type the email you've registered with."
                />
              </div>
              <p class="help is-danger" v-if="error">{{ error }}</p>
            </div>

            <hr />
            <p class="control">
              <button type="submit" class="button is-primary">Reset password</button>
              <router-link
                :to="{ name: 'oms.password_confirm' }"
                class="button"
              >Confirm password</router-link
              >
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

      this.axios
        .post(this.services['core'] + '/password_reset', {
          email: this.email
        })
        .then((response) => {
          // The answer is the same whether or not the email belongs to an account.
          this.$root.showSuccess(response.data.message)
          this.$router.push({ name: 'oms.password_confirm' })
        })
        .catch((err) => {
          this.$root.showError('Could not reset password', err)
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-block {
  width: 100%;
}
</style>
