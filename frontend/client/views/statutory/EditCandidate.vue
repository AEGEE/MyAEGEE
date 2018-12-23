<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveCandidate()">
        <div class="field" v-show="autoComplete.bodies.values.length > 0">
          <label class="label">Select body to apply from</label>
          <div class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autoComplete.bodies.name"
                :data="autoComplete.bodies.values"
                open-on-focus="true"
                @select="body => { candidate.body_id = body.id; candidate.body = body }">
                <template slot-scope="props">
                  <div class="media">
                    <div class="media-content">
                      {{ props.option.name }}
                    </div>
                  </div>
                </template>
              </b-autocomplete>
              <p class="control">
                <a class="button is-danger"
                  @click="body => { candidate.body_id = null; candidate.body = null }"
                  v-if="candidate.body">{{ candidate.body.name }} (Click to unset)</a>
                <a class="button is-static" v-if="!candidate.body">Not set.</a>
              </p>
            </div>
          </div>
        </div>

        <div class="notification is-danger" v-show="autoComplete.bodies.values.length == 0">
          <div class="content">
            <p>You are not a member of any local, therefore you cannot apply.</p>
            <p>To apply to a statutory event, you need to be a member of at least one local.</p>
            <p>For that, go to Bodies, send a join request to the local you are in and wait for the board to approve it</p>
          </div>
        </div>

        <div class="field">
          <label class="label">First name</label>
          <div class="control">
            <input class="input" type="text" required v-model="candidate.first_name" />
          </div>
          <p class="help is-danger" v-if="errors.first_name">{{ errors.first_name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Last name</label>
          <div class="control">
            <input class="input" type="text" required v-model="candidate.last_name" />
          </div>
          <p class="help is-danger" v-if="errors.last_name">{{ errors.last_name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Gender</label>
          <div class="control">
            <input class="input" type="text" required v-model="candidate.gender" />
          </div>
          <p class="help is-danger" v-if="errors.gender">{{ errors.gender.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Date of birth</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="candidate.date_of_birth" />
          </div>
          <p class="help is-danger" v-if="errors.date_of_birth">{{ errors.date_of_birth.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Member since</label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="candidate.member_since" />
          </div>
          <p class="help is-danger" v-if="errors.member_since">{{ errors.member_since.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Nationality</label>
          <div class="control">
            <div class="select">
              <select v-model="candidate.nationality">
                <option v-for="(country, index) in countries" v-bind:key="index" value="global">{{ country }}</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.nationality">{{ errors.nationality.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Languages</label>
          <div class="control">
            <input-tag v-model="candidate.languages"></input-tag>
          </div>
          <p class="help is-danger" v-if="errors.languages">{{ errors.languages.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Studies</label>
          <div class="control">
            <input class="input" type="text" required v-model="candidate.studies" />
          </div>
          <p class="help is-danger" v-if="errors.studies">{{ errors.studies.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Attended Agorae</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.attended_agorae" />
          </div>
          <p class="help is-danger" v-if="errors.attended_agorae">{{ errors.attended_agorae.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Attended EPM</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.attended_epm" />
          </div>
          <p class="help is-danger" v-if="errors.attended_epm">{{ errors.attended_epm.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Attended AEGEE conferences</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.attended_conferences" />
          </div>
          <p class="help is-danger" v-if="errors.attended_conferences">{{ errors.attended_conferences.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">European level experience</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.european_experience" />
          </div>
          <p class="help is-danger" v-if="errors.european_experience">{{ errors.european_experience.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Local level experience</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.local_experience" />
          </div>
          <p class="help is-danger" v-if="errors.local_experience">{{ errors.local_experience.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Task-related experience</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.related_experience" />
          </div>
          <p class="help is-danger" v-if="errors.related_experience">{{ errors.related_experience.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Non-AEGEE experience</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.external_experience" />
          </div>
          <p class="help is-danger" v-if="errors.external_experience">{{ errors.external_experience.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Motivation</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.motivation" />
          </div>
          <p class="help is-danger" v-if="errors.motivation">{{ errors.motivation.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Program</label>
          <div class="control">
            <textarea class="textarea" required v-model="candidate.program" />
          </div>
          <p class="help is-danger" v-if="errors.program">{{ errors.program.join(', ') }}</p>
        </div>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save candidature" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>

      <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'

import countries from '../../countries'

export default {
  name: 'EditCandidate',
  data () {
    return {
      candidate: {
        first_name: '',
        last_name: '',
        gender: '',
        date_of_birth: '',
        member_since: '',
        body_id: null,
        body: null,
        languages: []
      },
      countries,
      dateConfig: {},
      options: [],
      newValue: '',
      autoComplete: {
        bodies: { name: '', values: [], loading: false }
      },
      can: {
        edit_application_status: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveCandidate () {
      if (!this.candidate.body_id) {
        return this.$root.showDanger('Please select a body.')
      }

      this.isSaving = true
      this.errors = {}

      let promise = this.$route.params.candidate_id
        ? this.axios.put(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/' + this.$route.params.position_id + '/candidates/' + this.$route.params.candidate_id, this.candidate)
        : this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/' + this.$route.params.position_id + '/candidates/', this.candidate)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Candidate is saved.')

        return this.$router.push({
          name: 'oms.statutory.positions',
          params: { id: this.$route.params.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          if (!err.response.data.errors) {
            return this.$root.showDanger('Some of the candidate data is invalid: ' + err.response.data.message)
          }

          this.$set(this, 'errors', err.response.data.errors)
          return this.$root.showDanger('Some of the candidate data is invalid.')
        }

        this.$root.showDanger('Could not save candidate: ' + err.message)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    this.autoComplete.bodies.values = this.loginUser.bodies
      .filter(body => ['contact', 'contact antenna', 'antenna'].includes(body.type))

    if (!this.$route.params.candidate_id) {
      // Prefilling values
      this.candidate.first_name = this.loginUser.first_name
      this.candidate.last_name = this.loginUser.last_name
      this.candidate.gender = this.loginUser.gender
      this.candidate.date_of_birth = this.loginUser.date_of_birth
      this.candidate.member_since = moment(this.loginUser.user.inserted_at).format('YYYY-MM-DD')

      if (this.autoComplete.bodies.values.length) {
        this.candidate.body_id = this.autoComplete.bodies.values[0].id
        this.candidate.body = this.autoComplete.bodies.values[0]
      }
      return
    }

    this.candidate.body = this.loginUser.bodies.find(body => body.id === this.candidate.body_id)
    this.isLoading = true

    this.axios.get(
      this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/positions/' + this.$route.params.position_id + '/candidates/' + this.$route.params.candidate_id
    ).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Candidature is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.view', params: { id: this.$route.params.id } })
    })
  }
}
</script>
