<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">

      <div class="notification is-info">
        This form is only for creating members that are not yet signed up to a system. If you want to add an existing member to your body, go back to the body page and press 'Add member'!
      </div>

      <form @submit.prevent="createUser()">
        <div class="field">
          <label class="label">First name</label>
          <div class="control">
            <input class="input" type="text" required v-model="user.first_name" placeholder="Type your first name..." />
          </div>
          <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Last name</label>
          <div class="control">
            <input class="input" type="text" required v-model="user.last_name" placeholder="Type your last name..." />
          </div>
          <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="phone" /></span>
            <input class="input" type="text" v-model="user.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Birthday</label>
          <b-datepicker :date-formatter="formatDate" :date-parser="parseDate" v-model="birthday" @input="transformBirthday()" />
          <p class="help is-danger" v-if="errors.date_of_birth">{{ errors.date_of_birth.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Gender</label>
          <div class="control">
            <input class="input" type="text" v-model="user.gender" />
          </div>
          <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Address</label>
          <div class="control">
            <input class="input" type="text" v-model="user.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">About me</label>
          <div class="control">
            <input class="input" type="text" v-model="user.about_me" />
          </div>
          <p class="help is-danger" v-if="errors.about_me">{{ errors.about_me.join(', ')}}</p>
        </div>

        <hr />

        <div class="field">
          <label class="label">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="envelope" /></span>
            <input class="input" type="text" required v-model="user.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Username</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="fa envelope" /></span>
            <input class="input" type="text" required v-model="user.username" />
          </div>
          <p class="help is-danger" v-if="errors.username">{{ errors.username.join(', ')}}</p>
        </div>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save user" :disabled="isSaving" class="button is-primary is-fullwidth"/>
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
      return moment(date, 'YYYY-MM-DD').toDate()
    },
    formatDate (date) {
      return moment(date).format('YYYY-MM-DD')
    },
    transformBirthday () {
      this.user.date_of_birth = moment(this.birthday, 'YYYY-MM-DD').toDate()
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
