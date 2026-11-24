<template>
  <div class="content has-text-centered confirm-block">
    <div class="columns is-vcentered">
      <div class="column is-6 is-offset-3">
        <div class="box">
          <form v-on:submit.prevent="confirmToken">
            <div class="field">
              <label class="label" for="confirm-token">Token</label>
              <div class="control">
                <input
                  id="confirm-token"
                  v-model="token"
                  required
                  class="input"
                  type="text"
                  placeholder="Type the token you've received at your mailbox here."
                />
              </div>
            </div>

            <hr />
            <p class="control">
              <button type="submit" class="button is-primary">Confirm your email</button>
            </p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { ignoreNavigationFailure } from '../../methods/navigation'

export default {
  name: 'ConfirmToken',
  data () {
    return {
      token: ''
    }
  },
  computed: mapGetters(['services']),
  methods: {
    confirmToken () {
      this.axios
        .post(this.services['core'] + '/confirm-email', { token: this.token })
        .then(() => {
          this.$root.showSuccess('Your email is verified.')
          // A member who is logged in is sent on to the dashboard instead: that is no error.
          this.$router.push({ name: 'oms.login' }).catch(ignoreNavigationFailure)
        })
        .catch((err) => {
          if (err.response && err.response.status === 404) {
            // validation errors
            return this.$root.showError('The token is invalid.')
          }

          this.$root.showError('Could not confirm email', err)
        })
    }
  },
  mounted () {
    if (this.$route.query.token) {
      this.token = this.$route.query.token

      // Not doing this automatically, as it can be executed by a mailer robot.
      // this.confirmToken()
    }
  }
}
</script>

<style lang="scss" scoped>
.confirm-block {
  width: 100%;
}
</style>
