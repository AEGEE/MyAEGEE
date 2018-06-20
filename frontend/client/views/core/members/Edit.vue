<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveUser()">
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
          <label class="label">Profile URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/members/</a>
              </div>
              <div class="control">
                <input class="input" type="text" required v-model="user.seo_url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.seo_url">{{ errors.seo_url.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Email</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><i class="fa fa-envelope"></i></span>
            <input class="input" type="text" v-model="user.user.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
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
          <label class="label">Primary body</label>
          <p class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autocompleteBody"
                :data="user.bodies"
                open-on-focus="true"
                @select="body => { user.primary_body_id = body.id; user.primary_body = body } ">
                <template slot-scope="props">
                  <div class="media">
                    <div class="media-content">
                        {{ props.option.name }}
                        <br>
                        <small> {{ props.option.description }} </small>
                    </div>
                  </div>
                </template>
              </b-autocomplete>
              <p class="control">
                <a class="button is-danger"
                  @click="user.primary_body_id = null; user.primary_body = null"
                  v-if="user.primary_body">{{ user.primary_body.name }} (Click to unset)</a>
                <a class="button is-static" v-if="!user.primary_body">Not set.</a>
              </p>
            </div>
          <p class="help is-danger" v-if="errors.primary_body_id">{{ errors.primary_body_id.join(', ')}}</p>
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

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

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
import services from '../../../services.json'

export default {
  data () {
    return {
      user: {
        name: '',
        surname: '',
        id: null,
        seo_url: null,
        primary_body_id: null,
        primary_body: null,
        circles: null,
        date_of_birth: null,
        gender: null,
        phone: null,
        user: {},
        bodies: []
      },
      errors: {},
      birthday: null,
      isLoading: true,
      isSaving: false
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
      this.user.date_of_birth = moment(this.birthday, 'YYYY-MM-DD').toDate()
    },
    saveUser () {
      this.isSaving = true
      this.errors = {}

      this.axios.put(services['oms-core-elixir'] + '/members/' + this.$route.params.id, { member: this.user }).then((response) => {
        this.isSaving = false

        this.$toast.open({
          duration: 3000,
          message: 'User is saved.',
          type: 'is-success'
        })

        return this.$router.push({
          name: 'oms.members.view',
          params: { id: this.user.seo_url || this.user.id }
        })
      }).catch((err) => {
        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the user data is invalid.',
            type: 'is-danger'
          })
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not save user: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    this.axios.get(services['oms-core-elixir'] + '/members/' + this.$route.params.id).then((response) => {
      this.user = response.data.data
      this.birthday = response.data.data.date_of_birth ? moment(response.data.data.date_of_birth, 'YYYY-MM-DD').toDate() : null
      this.isLoading = false
    })
  }
}
</script>
