<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">

      <template>
        <div class="notification is-danger">
          <div class="content">
            <strong>Your profile has the following issues and you have to fix them before using the system:</strong>
            <ul>
              <li v-for="(error, key) in validationErrors" :key="key">{{ error }}</li>
            </ul>
          </div>
        </div>
      </template>

      <form @submit.prevent="saveUser()" v-if="validationErrors.privacy">
        <!-- <select-or-custom v-model="user.gender" data-cy="gender" :values="['Male', 'Female']" label="Gender">
          <template slot="errors-slot">
            <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ')}}</p>
          </template>
        </select-or-custom>

        <div class="field">
          <label class="label">Address</label>
          <div class="control">
            <input class="input" data-cy="address" type="text" v-model="user.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">About me</label>
          <div class="control">
            <input class="input" data-cy="about_me" type="text" v-model="user.about_me" />
          </div>
          <p class="help is-danger" v-if="errors.about_me">{{ errors.about_me.join(', ')}}</p>
        </div> -->

        <div class="field">
          <label class="label">
            I agree to the <router-link :to="{ name: 'oms.confluence', params: { page_id: 'terms-of-service' } }">Privacy Policy</router-link>
            <input type="checkbox" class="checkbox" id="checkbox" v-model="agreedToPrivacyPolicy">
          </label>
        </div>

        <b-loading :is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save user" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>

      <hr v-if="validationErrors.email" />

      <div class="field" v-if="validationErrors.email">
        <label class="label">Email <span class="has-text-danger">*</span></label>
        <div class="field has-addons">
          <div class="control is-expanded">
            <input class="input" type="email" v-model="tmpEmail" />
          </div>
          <div class="control">
            <button class="button is-info" @click="changeEmail(tmpEmail)">Change email</button>
          </div>
        </div>
      </div>

      <hr v-if="validationErrors.bodies" />

      <div class="field" v-if="validationErrors.bodies">
        <label class="label">
          Body <span class="has-text-danger">*</span>
          <tooltip text="You can change your notification email in your profile" />
        </label>
        <div class="field has-addons">
          <div class="control is-expanded">
            <div class="select is-fullwidth">
              <select v-model="tmpBodyId">
                <option v-for="body in bodies" v-bind:key="body.id" :value="body.id">{{ body.name }}</option>
              </select>
            </div>
          </div>
          <div class="control">
            <button class="button is-info" @click="askToJoinBody(tmpBodyId)">Join body</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import _ from 'lodash'
import { mapGetters } from 'vuex'
import moment from 'moment'
import { RESTRICTED_EMAILS, ALLOWED_BODY_TYPES } from '../../../validate-user'

export default {
  name: 'UpdateProfile',
  data () {
    return {
      user: {
        first_name: '',
        last_name: '',
        id: null,
        username: null,
        primary_body_id: null,
        primary_body: null,
        circles: null,
        date_of_birth: null,
        gender: null,
        phone: null,
        privacy_consent: null,
        address: null,
        about_me: null,
        user: {},
        bodies: []
      },
      bodies: [],
      tmpBodyId: null,
      tmpEmail: '',
      errors: {},
      birthday: null,
      isLoading: true,
      isSaving: false,
      agreedToPrivacyPolicy: false
    }
  },
  methods: {
    saveUser () {
      if (!this.agreedToPrivacyPolicy) {
        return this.$root.showError('You should agree to the Privacy Policy.')
      }

      this.user.privacy_consent = moment().format()

      this.isSaving = true
      this.errors = {}

      const body = _.pick(this.user, [
        'id',
        'first_name',
        'last_name',
        'username',
        'gender',
        'about_me',
        'address',
        'phone',
        'date_of_birth',
        'privacy_consent'
      ])

      this.axios.put(this.services['core'] + '/members/me', body).then(() => {
        this.isSaving = false

        this.$root.showSuccess('User is saved.')

        /* istanbul ignore next */
        this.$router.go()
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the user data is invalid.')
        }

        this.$root.showError('Could not save user', err)
      })
    },
    askToJoinBody (bodyId) {
      this.$buefy.dialog.prompt({
        message: 'Join body',
        inputAttrs: {
          placeholder: 'Motivation',
          required: false
        },
        onConfirm: (motivation) => this.joinBody(bodyId, motivation)
      })
    },
    joinBody (bodyId, motivation) {
      this.isLoading = true
      this.axios.post(this.services['core'] + '/bodies/' + bodyId + '/join-requests', {
        motivation
      }).then(() => {
        this.$root.showSuccess('Join request is sent. Please wait until a board members accepts it.')
        this.isLoading = false
        this.isRequestingMembership = true
      }).catch((err) => {
        this.isLoading = false
        if (err.response.status === 422) {
          this.$root.showError('You\'ve already requested to join this body.')
        } else {
          this.$root.showError('Could not sent join request', err)
        }
      })
    },
    changeEmail (newEmail) {
      if (RESTRICTED_EMAILS.some(domain => newEmail.includes(domain))) {
        return this.$root.showError('Your email can not be in one of the following domains: ' + RESTRICTED_EMAILS.join(', ').trim() + '.')
      }

      this.axios.put(this.services['core'] + '/members/me/email', { new_email: newEmail }).then(() => {
        this.$root.showSuccess('An email change is triggered. Check your new inbox for a confirmation.')
      }).catch((err) => {
        this.$root.showError('Error changing user email', err)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loggedIn: 'loggedIn',
    loginUser: 'user',
    isValid: 'isValid',
    validationErrors: 'validationErrors'
  }),
  mounted () {
    if (this.isValid) {
      console.debug('User is valid, redirecting.')
      return this.$router.push({ name: 'oms.dashboard' })
    }

    this.axios.get(this.services['core'] + '/members/me').then((response) => {
      this.user = response.data.data

      return this.axios.get(this.services['core'] + '/bodies')
    }).then((response) => {
      this.bodies = response.data.data.filter(b => ALLOWED_BODY_TYPES.includes(b.type))
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('User is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }
    })
  }
}
</script>

<style scoped>
  #checkbox {
    margin-left: 0.5vw
  }
</style>
