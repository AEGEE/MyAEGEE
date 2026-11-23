<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <h1 class="title">Create member</h1>

      <div class="notification is-info">
        This form is only for creating members that are not yet signed up to a system. If you want to add an existing member to your body, go back to the body page and press 'Add member'!
      </div>

      <form @submit.prevent="createUser()">
        <div class="field">
          <label class="label" for="new-member-first-name">First name</label>
          <div class="control">
            <input id="new-member-first-name" class="input" type="text" required v-model="user.first_name" placeholder="Type your first name..." />
          </div>
          <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-last-name">Last name</label>
          <div class="control">
            <input id="new-member-last-name" class="input" type="text" required v-model="user.last_name" placeholder="Type your last name..." />
          </div>
          <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-phone">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="phone" /></span>
            <input id="new-member-phone" class="input" type="text" v-model="user.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-birthday">Birthday</label>
          <b-datepicker id="new-member-birthday" editable :mobile-native="false" :date-formatter="formatDate" :date-parser="parseDate" v-model="birthday" @input="transformBirthday()" />
          <p class="help is-danger" v-if="errors.date_of_birth">{{ errors.date_of_birth.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-gender">Gender</label>
          <div class="control">
            <input id="new-member-gender" class="input" type="text" v-model="user.gender" />
          </div>
          <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-address">Address</label>
          <div class="control">
            <input id="new-member-address" class="input" type="text" v-model="user.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-about-me">About me</label>
          <div class="control">
            <input id="new-member-about-me" class="input" type="text" v-model="user.about_me" />
          </div>
          <p class="help is-danger" v-if="errors.about_me">{{ errors.about_me.join(', ')}}</p>
        </div>

        <hr />

        <div class="field">
          <label class="label" for="new-member-email">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="envelope" /></span>
            <input id="new-member-email" class="input" type="email" required v-model="user.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="new-member-username">Username</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="fa envelope" /></span>
            <input id="new-member-username" class="input" type="text" required v-model="user.username" />
          </div>
          <p class="help is-danger" v-if="errors.username">{{ errors.username.join(', ')}}</p>
        </div>

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
import moment from 'moment'
import { mapGetters } from 'vuex'

export default {
  name: 'CreateMemberForBody',
  data () {
    return {
      user: {
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        address: '',
        username: '',
        email: ''
      },
      errors: {},
      birthday: null,
      isSaving: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    parseDate (date) {
      return date ? moment(date, 'YYYY-MM-DD').toDate() : null
    },
    formatDate (date) {
      return moment(date).format('YYYY-MM-DD')
    },
    transformBirthday () {
      this.user.date_of_birth = this.birthday ? moment(this.birthday).format('YYYY-MM-DD') : ''
    },
    createUser () {
      this.isSaving = true
      this.errors = {}

      this.axios.post(this.services['core'] + '/bodies/' + this.$route.params.id + '/create-member', this.user).then(() => {
        this.isSaving = false
        this.$root.showSuccess('User is created.')
        this.$router.push({ name: 'oms.bodies.members', params: { id: this.$route.params.id } })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the user data is invalid.')
        }

        this.$root.showError('Could not create user', err)
      })
    }
  }
}
</script>
