<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveBody()">
        <div class="field">
          <label class="label">Type <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="select">
              <select v-model="body.type" required :disabled="!can.editType">
                <option value="antenna">Antenna</option>
                <option value="contact antenna">Contact antenna</option>
                <option value="contact">Contact</option>
                <option value="interest group">Interest group</option>
                <option value="working group">Working group</option>
                <option value="commission">Commission</option>
                <option value="committee">Committee</option>
                <option value="project">Project</option>
                <option value="partner">Partner association</option>
                <option value="external">External association</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Name <span class="has-text-danger">*</span></label>
          <div class="control">
            <input class="input" type="text" required :disabled="!can.editName" v-model="body.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field" v-if="!['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label">Abbreviation (if applicable)</label>
          <div class="control">
            <input class="input" type="text" :disabled="!can.editAbbreviation" v-model="body.abbreviation" />
          </div>
          <p class="help is-danger" v-if="errors.abbreviation">{{ errors.abbreviation.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="body.description" />
          </div>
          <label class="label">Preview <MarkdownTooltip /></label>
          <div class="content">
            <span v-html="$options.filters.markdown(body.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">
            Task description (if applicable)
            <tooltip text="Only applicable to bodies that have Agora-elected positions" />
          </label>
          <div class="control">
            <textarea class="textarea" v-model="body.task_description" />
          </div>
          <label class="label">Preview <MarkdownTooltip /></label>
          <div class="content">
            <span v-html="$options.filters.markdown(body.task_description)" />
          </div>
          <p class="help is-danger" v-if="errors.task_description">{{ errors.task_description.message }}</p>
        </div>

        <div class="field">
          <label class="label">Body code <span class="has-text-danger">*</span></label>
          <div class="control">
            <input class="input" type="text" required :disabled="!can.editCode" v-model="body.code" pattern="[A-Za-z]{3}" title="Body code should contain only 3 letters" />
          </div>
          <p class="help is-danger" v-if="errors.code">{{ errors.code.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Country</label>
          <div class="control">
            <div class="select">
              <select v-model="body.country">
                <option v-for="(country, index) in countries" v-bind:key="index">{{ country }}</option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.country">{{ errors.country.join(', ') }}</p>
        </div>

        <div class="field" v-if="['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label">Founded at <span class="has-text-danger">*</span></label>
          <b-datepicker :date-formatter="formatDate" :date-parser="parseDate" required v-model="foundationDate" @input="transformFoundedAt()" />
          <p class="help is-danger" v-if="errors.founded_at">{{ errors.founded_at.join(', ')}}</p>
        </div>

        <div class="field" v-if="!['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label">Founded at (if applicable)</label>
          <b-datepicker :date-formatter="formatDate" :date-parser="parseDate" v-model="foundationDate" @input="transformFoundedAt()" />
          <p class="help is-danger" v-if="errors.founded_at">{{ errors.founded_at.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Email <span class="has-text-danger">*</span></label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="envelope" /></span>
            <input class="input" type="email" v-model="body.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Google Workspace account</label>
          <div class="control">
            <input class="input" data-cy="gsuite_id" type="email" :disabled="!can.editGsuite" v-model="body.gsuite_id" placeholder="Type the Google Workspace email of the body" />
          </div>
          <p class="help is-danger" v-if="errors.gsuite_id">{{ errors.gsuite_id.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Google Group</label>
          <div class="control">
            <input class="input" data-cy="google_group" type="email" :disabled="!can.editGsuite" v-model="body.google_group" placeholder="Type the Google Group of the body" />
          </div>
          <p class="help is-danger" v-if="errors.google_group">{{ errors.google_group.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="phone" /></span>
            <input class="input" type="text" v-model="body.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Address</label>
          <div class="control">
            <input class="input" type="text" v-model="body.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">
            Postal address (if applicable)
            <tooltip text="Only applicable to bodies that have a different postal address than their regular address" />
          </label>
          <div class="control">
            <input class="input" type="text" v-model="body.postal_address" />
          </div>
          <p class="help is-danger" v-if="errors.postal_address">{{ errors.postal_address.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Website</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="globe" /></span>
            <input class="input" type="text" v-model="body.website" />
          </div>
          <p class="help is-danger" v-if="errors.website">{{ errors.website.join(', ')}}</p>
        </div>

        <div class="field" v-if="$route.params.id && can.editShadowCircle">
          <label class="label">Shadow circle</label>
          <p class="control" /><div class="field has-addons">
            <b-autocomplete
              v-model="autocompleteBody"
              :data="filteredShadowCircles"
              :disabled="!can.editShadowCircle"
              :open-on-focus="true"
              @select="circle => { body.shadow_circle_id = circle.id; body.shadow_circle = circle }">
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
            <p class="control" v-if="can.editShadowCircle">
              <a
                class="button is-danger"
                @click="body.shadow_circle_id = null; body.shadow_circle = null"
                v-if="body.shadow_circle">{{ body.shadow_circle.name }} (Click to unset)</a>
              <a class="button is-static" v-if="!body.shadow_circle">Not set.</a>
            </p>
            <p class="control" v-if="!can.editShadowCircle">
              <a class="button is-static" v-if="body.shadow_circle">{{ body.shadow_circle.name }}</a>
              <a class="button is-static" v-if="!body.shadow_circle">Not set.</a>
            </p>
          </div>
          <p class="help is-danger" v-if="errors.shadow_circle_id">{{ errors.shadow_circle_id.join(', ')}}</p>
        </div>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save body" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'

import countries from '../../../countries'
import MarkdownTooltip from '../../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MarkdownTooltip
  },
  name: 'EditBody',
  data () {
    return {
      body: {
        name: '',
        abbreviation: null,
        description: '',
        task_description: '',
        id: null,
        code: null,
        email: null,
        gsuite_id: null,
        google_group: null,
        phone: null,
        address: null,
        postal_address: null,
        shadow_circle_id: null,
        shadow_circle: null,
        circles: []
      },
      foundationDate: null,
      permissions: [],
      can: {
        editName: true,
        editAbbreviation: true,
        editCode: true,
        editShadowCircle: true,
        editType: true,
        editGsuite: false
      },
      countries,
      autocompleteBody: '',
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters(['services']),
    filteredShadowCircles () {
      return this.body.circles.filter(circle => circle.name.toLowerCase().includes(this.autocompleteBody.toLowerCase()))
    }
  },
  methods: {
    parseDate (date) {
      return moment(date, 'YYYY-MM-DD').toDate()
    },
    formatDate (date) {
      return moment(date).format('YYYY-MM-DD')
    },
    transformFoundedAt () {
      this.body.founded_at = moment(this.foundationDate).format('YYYY-MM-DD')
    },
    saveBody () {
      if (['antenna', 'contact antenna', 'contact'].includes(this.body.type) && !this.body.founded_at) {
        return this.$root.showError('Please set the founding date of the local.')
      }

      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.services['core'] + '/bodies/' + this.$route.params.id, this.body)
        : this.axios.post(this.services['core'] + '/bodies/', this.body)

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Body is saved.')

        return this.$router.push({
          name: 'oms.bodies.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the body data is invalid.')
        }

        this.$root.showError('Could not save body', err)
      })
    }
  },
  mounted () {
    if (!this.$route.params.id) {
      return // if creating new body
    }

    this.isLoading = true
    this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id).then((response) => {
      this.body = response.data.data
      this.foundationDate = response.data.data.founded_at ? moment(response.data.data.founded_at, 'YYYY-MM-DD').toDate() : null

      this.isLoading = false

      return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data

      const editGlobalPermission = this.permissions.find(permission => permission.combined.endsWith('global:update:body'))
      this.can.editName = editGlobalPermission
      this.can.editAbbreviation = editGlobalPermission
      this.can.editCode = editGlobalPermission
      this.can.editShadowCircle = editGlobalPermission
      this.can.editType = editGlobalPermission
      this.can.editGsuite = editGlobalPermission
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Body is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.bodies.list' })
    })
  }
}
</script>
