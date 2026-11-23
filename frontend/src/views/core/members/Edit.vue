<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <form @submit.prevent="saveUser()">
        <div class="field">
          <label class="label" for="member-first-name">First name</label>
          <div class="control">
            <input
              id="member-first-name"
              class="input"
              type="text"
              required
              v-model="user.first_name"
              placeholder="Type your first name..."
            />
          </div>
          <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="member-last-name">Last name</label>
          <div class="control">
            <input
              id="member-last-name"
              class="input"
              type="text"
              required
              v-model="user.last_name"
              placeholder="Type your last name..."
            />
          </div>
          <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="member-username">Username</label>
          <div class="control">
            <input
              id="member-username"
              class="input"
              type="text"
              required
              v-model="user.username"
              placeholder="Type your username..."
            />
          </div>
          <p class="help is-danger" v-if="errors.username">{{ errors.username.join(', ') }}</p>
        </div>

        <div class="field" v-if="can.editGsuite">
          <label class="label" for="member-gsuite-id">Google Workspace account</label>
          <div class="control">
            <input
              id="member-gsuite-id"
              class="input"
              type="email"
              v-model="user.gsuite_id"
              placeholder="Type the Google Workspace email of the user"
            />
          </div>
          <p class="help is-danger" v-if="errors.gsuite_id">{{ errors.gsuite_id.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="member-phone">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="phone" /></span>
            <input id="member-phone" class="input" type="text" v-model="user.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="member-birthday">Birthday</label>
          <b-datepicker
            id="member-birthday"
            editable
            :mobile-native="false"
            :date-formatter="formatDate"
            :date-parser="parseDate"
            v-model="birthday"
            @input="transformBirthday()"
          />
          <p class="help is-danger" v-if="errors.date_of_birth">
            {{ errors.date_of_birth.join(', ') }}
          </p>
        </div>

        <select-or-custom v-model="user.gender" :values="['Male', 'Female']" label="Gender">
          <template slot="errors-slot">
            <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ') }}</p>
          </template>
        </select-or-custom>

        <div class="field">
          <label class="label" for="member-address">Address</label>
          <div class="control">
            <input id="member-address" class="input" type="text" v-model="user.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="member-about-me">About me</label>
          <div class="control">
            <input id="member-about-me" class="input" type="text" v-model="user.about_me" />
          </div>
          <p class="help is-danger" v-if="errors.about_me">{{ errors.about_me.join(', ') }}</p>
        </div>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input
              type="submit"
              value="Save user"
              :disabled="isSaving"
              class="button is-primary is-fullwidth"
            />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import pick from 'lodash/pick'
import { mapGetters } from 'vuex'

export default {
  name: 'EditMember',
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
        gsuite_id: null,
        phone: null,
        address: null,
        about_me: null,
        bodies: []
      },
      errors: {},
      birthday: null,
      isLoading: true,
      isSaving: false,
      can: {
        editGsuite: false
      }
    }
  },
  methods: {
    parseDate (date) {
      return moment(date, 'YYYY-MM-DD').toDate()
    },
    formatDate (date) {
      return moment(date).format('YYYY-MM-DD')
    },
    transformBirthday () {
      // A cleared field is no birthday, not an invalid one.
      this.user.date_of_birth = this.birthday ? moment(this.birthday).format('YYYY-MM-DD') : null
    },
    saveUser () {
      this.isSaving = true
      this.errors = {}

      const fields = [
        'id',
        'first_name',
        'last_name',
        'username',
        'gender',
        'about_me',
        'address',
        'phone',
        'date_of_birth'
      ]

      // Only global managers see and set the Google Workspace account.
      if (this.can.editGsuite) {
        fields.push('gsuite_id')
      }

      const body = pick(this.user, fields)
      // An empty field means the member has no Workspace account.
      if (this.can.editGsuite && !body.gsuite_id) {
        body.gsuite_id = null
      }

      this.axios
        .put(this.services['core'] + '/members/' + this.$route.params.id, body)
        .then(() => {
          this.isSaving = false

          this.$root.showSuccess('User is saved.')

          return this.$router.push({
            name: 'oms.members.view',
            params: { id: this.user.username || this.user.id }
          })
        })
        .catch((err) => {
          this.isSaving = false

          if (err.response && err.response.status === 422) {
            // validation errors
            this.errors = err.response.data.errors
            return this.$root.showError('Some of the user data is invalid.')
          }

          this.$root.showError('Could not save user', err)
        })
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.axios
      .get(this.services['core'] + '/members/' + this.$route.params.id)
      .then((response) => {
        this.user = response.data.data

        this.birthday = response.data.data.date_of_birth
          ? moment(response.data.data.date_of_birth, 'YYYY-MM-DD').toDate()
          : null
        this.isLoading = false

        return this.axios.get(
          this.services['core'] + '/members/' + this.$route.params.id + '/my_permissions'
        )
      })
      .then((response) => {
        this.permissions = response.data.data

        this.can.editGsuite = this.permissions.some((permission) => permission.combined.endsWith('global:update:member'))
      })
      .catch((err) => {
        if (err.response && err.response.status === 404) {
          this.$root.showError('User is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }

        this.$router.push({ name: 'oms.members.list' })
      })
  }
}
</script>
