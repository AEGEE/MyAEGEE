<template>
  <div class="content has-text-centered confirm-block">
    <div class="columns is-vcentered">
      <div class="column is-6 is-offset-3">
        <div class="box">
          <form v-on:submit.prevent="confirmToken">
            <div class="field">
              <label class="label">Token</label>
              <div class="control">
                <input v-model="token" data-cy="token" required class="input" type="text" placeholder="Type the token you've received at your mailbox here.">
              </div>
              <p class="help is-danger" v-if="error">{{ error }}</p>
            </div>

            <hr />
            <p class="control">
              <button type="submit" class="button is-primary">Change your email</button>
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
  name: 'MailChange',
  data () {
    return {
      token: '',
      error: ''
    }
  },
  computed: mapGetters(['services']),
  methods: {
    confirmToken () {
      this.error = ''

      this.axios.post(this.services['core'] + '/confirm-email-change', { token: this.token }).then(() => {
        this.$root.showSuccess('Your email is changed.')
        return this.$router.push({ name: 'oms.members.view', params: { id: 'me' } })
      }).catch((err) => {
        if (err.response.status === 404) { // validation errors
          return this.$root.showError('The token is invalid.')
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
  width: 100%
}
</style>
