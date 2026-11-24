<template>
  <div class="content has-text-centered confirm-block">
    <div class="columns is-vcentered">
      <div class="column is-6 is-offset-3">
        <div class="box">
          <div class="notification is-info is-light" role="status" v-if="notice">{{ notice }}</div>
          <form v-on:submit.prevent="confirmToken">
            <div class="field">
              <label class="label" for="mail-change-token">Token</label>
              <div class="control">
                <input
                  id="mail-change-token"
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
              <button type="submit" class="button is-primary">Confirm email change</button>
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
  name: 'MailChange',
  data () {
    return {
      token: '',
      notice: ''
    }
  },
  computed: mapGetters(['services']),
  methods: {
    confirmToken () {
      this.notice = ''

      this.axios
        .post(this.services['core'] + '/confirm-email-change', { token: this.token })
        .then((response) => {
          // Some changes need a confirmation from both the current and the new address.
          // Until the other one confirms there's nothing to see on the profile, so staying here.
          if (response.data.data.changed === false) {
            this.notice = response.data.message
            return
          }

          this.$root.showSuccess(response.data.message)
          // Somebody who is logged out is sent to log in first: that is no error.
          this.$router.push({ name: 'oms.members.view', params: { id: 'me' } }).catch(ignoreNavigationFailure)
        })
        .catch((err) => {
          if (err.response && err.response.status === 404) {
            return this.$root.showError('The token is invalid or expired.')
          }

          if (err.response && err.response.status === 422 && err.response.data.errors && err.response.data.errors.email) {
            return this.$root.showError('Could not change email: ' + err.response.data.errors.email.join(', '))
          }

          this.$root.showError('Could not change email', err)
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
  width: 100%;
}
</style>
