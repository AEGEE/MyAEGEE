<template>
<div class="content has-text-centered register-block">
  <div class="columns is-vcentered">
    <div class="column is-6 is-offset-3">
      <div class="box">
        <form v-on:submit.prevent="register">
          <div class="field">
            <label class="label">Username</label>
            <div class="control">
              <input
                v-model="submission.name"
                required
                class="input"
                type="text"
                pattern="^[a-zA-Z0-9\.\-].*$"
                title="Username can only contain English letters, numbers, dots and dashes."
                placeholder="You will be able to login with it." />
            </div>
             <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Email</label>
            <div class="control">
              <input v-model="submission.email" required class="input" type="email" placeholder="Email address the system will send letters to.">
            </div>
             <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Password</label>
            <div class="control">
              <input v-model="submission.password" required class="input" type="password" minlength="8" placeholder="Type a secure password.">
            </div>
             <p class="help is-danger" v-if="errors.password">{{ errors.password.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Password confirmation</label>
            <div class="control">
              <input v-model="submission.password_copy" required class="input" type="password" minlength="8" placeholder="Repeat your password.">
            </div>
             <p class="help is-danger" v-if="errors.password_copy">{{ errors.password_copy.join(', ')}}</p>
          </div>

          <hr />

          <div class="field">
            <label class="label">First name</label>
            <div class="control">
              <input v-model="submission.first_name" required class="input" type="text" placeholder="E.g. Stephen">
            </div>
             <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Last name</label>
            <div class="control">
              <input v-model="submission.last_name" required class="input" type="text" placeholder="E.g. Hawking">
            </div>
             <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Motivation</label>
            <div class="control">
              <input v-model="submission.motivation" required class="input" type="text" placeholder="Why you want to be a member.">
            </div>
             <p class="help is-danger" v-if="errors.motivation">{{ errors.motivation.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">I agree to the <router-link :to="{ name: 'oms.legal.simple' }">Privacy Policy</router-link>
              <input type="checkbox" class="checkbox" v-model="agreedToPrivacyPolicy" />
            </label>
             <p class="help is-danger" v-if="errors.agreedToPrivacyPolicy">{{ errors.agreedToPrivacyPolicy.join(', ')}}</p>
          </div>

          <hr />
          <p class="control">
            <button type="submit" class="button is-primary">Register</button>
            <router-link :to="{ name: 'oms.login' }" class="button">Login</router-link>
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
  name: 'Register',
  data () {
    return {
      submission: {
        name: '',
        password: '',
        password_copy: '',
        first_name: '',
        last_name: '',
        email: '',
        motivation: ''
      },
      agreedToPrivacyPolicy: false,
      errors: {}
    }
  },
  computed: mapGetters(['services']),
  methods: {
    register () {
      this.errors = {}

      if (!this.agreedToPrivacyPolicy) {
        this.errors.agreedToPrivacyPolicy = ['You need to agree with our Privacy Policy.']
        return
      }

      if (this.submission.password !== this.submission.password_copy) {
        this.errors.password = ['The passwords do not match.']
        return
      }

      this.axios.post(this.services['oms-core-elixir'] + '/campaigns/' + this.$route.params.id, {
        submission: this.submission
      }).then((res) => {
        this.$root.showSuccess('Your submission is registered.')
        return this.$router.push({ name: 'oms.confirm_token' })
      }).catch((err) => {
        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the registration data is invalid.')
        }

        if (err.response.status === 404) { // validation errors
          return this.$root.showDanger('The registration campaign is not found.')
        }

        this.$root.showDanger('Could not register: ' + err.message)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.register-block {
  width: 100%
}
</style>
