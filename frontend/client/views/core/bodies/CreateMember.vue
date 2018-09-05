<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">

      <div class="notification is-info">
        This form is only for creating members that are not yet signed up to a system. If you want to add an existing member to your body, ask them to create a join request and approve that join request!
      </div>

      <form @submit.prevent="createUser()">
        <div class="field">
          <label class="label">First name</label>
          <div class="control">
            <input class="input" type="text" required v-model="user.member.first_name" placeholder="Type your first name..." />
          </div>
          <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Last name</label>
          <div class="control">
            <input class="input" type="text" required v-model="user.member.last_name" placeholder="Type your last name..." />
          </div>
          <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Profile URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/members/</a>
              </div>
              <div class="control">
                <input class="input" type="text" required v-model="user.member.seo_url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.seo_url">{{ errors.seo_url.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-phone"></i></span>
            <input class="input" type="text" v-model="user.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Birthday</label>
          <b-datepicker :date-formatter="formatDate" :date-parser="parseDate" v-model="birthday" @input="transformBirthday()" />
          <p class="help is-danger" v-if="errors.birthday">{{ errors.birthday.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Gender</label>
          <div class="control">
            <input class="input" type="text" v-model="user.member.gender" />
          </div>
          <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Address</label>
          <div class="control">
            <input class="input" type="text" v-model="user.member.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">About me</label>
          <div class="control">
            <input class="input" type="text" v-model="user.member.about_me" />
          </div>
          <p class="help is-danger" v-if="errors.about_me">{{ errors.about_me.join(', ')}}</p>
        </div>

        <hr />

        <div class="field">
          <label class="label">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="text" required v-model="user.user.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Username</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="text" required v-model="user.user.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
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
        member: {
          first_name: '',
          last_name: '',
          seo_url: '',
          date_of_birth: '',
          gender: '',
          phone: '',
          address: ''
        },
        user: {
          name: '',
          email: ''
        }
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
      this.user.member.date_of_birth = moment(this.birthday, 'YYYY-MM-DD').toDate()
    },
    createUser () {
      this.isSaving = true
      this.errors = {}

      this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/new_member', {
        member: this.user.member,
        user: this.user.user
      }).then((response) => {
        this.isSaving = false
        this.$root.showSucccess('User is created.')
        this.$router.push({ name: 'oms.members.view', params: { id: response.data.data.id } })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the user data is invalid.')
        }

        this.$root.showDanger('Could not create user: ' + err.message)
      })
    }
  }
}
</script>
