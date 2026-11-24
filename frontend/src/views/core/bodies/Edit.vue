<template>
  <div class="tile is-ancestor">
    <div class="tile is-child">
      <h1 class="title">{{ $route.params.id ? 'Edit body' : 'Create body' }}</h1>
      <form @submit.prevent="saveBody()">
        <div class="field">
          <label class="label" for="body-type">Type <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="select">
              <select id="body-type" v-model="body.type" required :disabled="!can.editType">
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
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-name">Name <span class="has-text-danger">*</span></label>
          <div class="control">
            <input
              id="body-name"
              class="input"
              type="text"
              required
              :disabled="!can.editName"
              v-model="body.name"
            />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field" v-if="!['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label" for="body-abbreviation">Abbreviation (if applicable)</label>
          <div class="control">
            <input
              id="body-abbreviation"
              class="input"
              type="text"
              :disabled="!can.editAbbreviation"
              v-model="body.abbreviation"
            />
          </div>
          <p class="help is-danger" v-if="errors.abbreviation">
            {{ errors.abbreviation.join(', ') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="body-description">Description <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea
              id="body-description"
              class="textarea"
              placeholder="e.g. Hello world"
              required
              v-model="body.description"
            />
          </div>
          <p class="label">Preview <MarkdownTooltip /></p>
          <div class="content" role="region" aria-label="Preview of the description">
            <span v-html="$options.filters.markdown(body.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">
            {{ errors.description.join(', ') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="body-task-description">
            Task description (if applicable)
            <tooltip text="Only applicable to bodies that have Agora-elected positions" />
          </label>
          <div class="control">
            <textarea id="body-task-description" class="textarea" v-model="body.task_description" />
          </div>
          <p class="label">Preview <MarkdownTooltip /></p>
          <div class="content" role="region" aria-label="Preview of the task description">
            <span v-html="$options.filters.markdown(body.task_description)" />
          </div>
          <p class="help is-danger" v-if="errors.task_description">
            {{ errors.task_description.join(', ') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="body-code">Body code <span class="has-text-danger">*</span></label>
          <div class="control">
            <input
              id="body-code"
              class="input"
              type="text"
              required
              :disabled="!can.editCode"
              v-model="body.code"
              pattern="[A-Za-z]{3}"
              title="Body code should contain only 3 letters"
            />
          </div>
          <p class="help is-danger" v-if="errors.code">{{ errors.code.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-country">Country</label>
          <div class="control">
            <div class="select">
              <select id="body-country" v-model="body.country">
                <option v-for="(country, index) in countries" v-bind:key="index">
                  {{ country }}
                </option>
              </select>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.country">{{ errors.country.join(', ') }}</p>
        </div>

        <div class="field" v-if="['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label" for="body-founded-at">Founded at <span class="has-text-danger">*</span></label>
          <b-datepicker
            id="body-founded-at"
            editable
            :mobile-native="false"
            :date-formatter="formatDate"
            :date-parser="parseDate"
            v-model="foundationDate"
            @input="transformFoundedAt()"
          />
          <p class="help is-danger" v-if="errors.founded_at">{{ errors.founded_at.join(', ') }}</p>
        </div>

        <div class="field" v-if="!['antenna', 'contact antenna', 'contact'].includes(body.type)">
          <label class="label" for="body-founded-at">Founded at (if applicable)</label>
          <b-datepicker
            id="body-founded-at"
            editable
            :mobile-native="false"
            :date-formatter="formatDate"
            :date-parser="parseDate"
            v-model="foundationDate"
            @input="transformFoundedAt()"
          />
          <p class="help is-danger" v-if="errors.founded_at">{{ errors.founded_at.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-email">Email <span class="has-text-danger">*</span></label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="envelope" /></span>
            <input id="body-email" class="input" type="email" required v-model="body.email" />
          </div>
          <p class="help is-danger" v-if="errors.email">{{ errors.email.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-gsuite-id">Google Workspace account</label>
          <div class="control">
            <input
              id="body-gsuite-id"
              class="input"
              type="email"
              :disabled="!can.editGsuite"
              v-model="body.gsuite_id"
              placeholder="Type the Google Workspace email of the body"
            />
          </div>
          <p class="help is-danger" v-if="errors.gsuite_id">{{ errors.gsuite_id.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-google-group">Google Group</label>
          <div class="control">
            <input
              id="body-google-group"
              class="input"
              type="email"
              :disabled="!can.editGsuite"
              v-model="body.google_group"
              placeholder="Type the Google Group of the body"
            />
          </div>
          <p class="help is-danger" v-if="errors.google_group">
            {{ errors.google_group.join(', ') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="body-phone">Phone</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="phone" /></span>
            <input id="body-phone" class="input" type="text" v-model="body.phone" />
          </div>
          <p class="help is-danger" v-if="errors.phone">{{ errors.phone.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-address">Address</label>
          <div class="control">
            <input id="body-address" class="input" type="text" v-model="body.address" />
          </div>
          <p class="help is-danger" v-if="errors.address">{{ errors.address.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="body-postal-address">
            Postal address (if applicable)
            <tooltip
              text="Only applicable to bodies that have a different postal address than their regular address"
            />
          </label>
          <div class="control">
            <input id="body-postal-address" class="input" type="text" v-model="body.postal_address" />
          </div>
          <p class="help is-danger" v-if="errors.postal_address">
            {{ errors.postal_address.join(', ') }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="body-website">Website</label>
          <div class="control has-icons-left">
            <span class="icon is-small is-left"><font-awesome-icon icon="globe" /></span>
            <input id="body-website" class="input" type="url" placeholder="https://" v-model="body.website" />
          </div>
          <p class="help is-danger" v-if="errors.website">{{ errors.website.join(', ') }}</p>
        </div>

        <div class="field" v-if="$route.params.id && can.editShadowCircle">
          <label class="label" for="body-shadow-circle">Shadow circle</label>
          <p class="control" />
          <div class="field has-addons">
            <b-autocomplete
              id="body-shadow-circle"
              field="name"
              v-model="autocompleteBody"
              :data="filteredShadowCircles"
              :open-on-focus="true"
              @select="
                (circle) => {
                  body.shadow_circle_id = circle.id;
                  body.shadow_circle = circle;
                }
              "
            >
              <template slot-scope="props">
                <div class="media">
                  <div class="media-content">
                    {{ props.option.name }}
                    <br />
                    <small> {{ props.option.description }} </small>
                  </div>
                </div>
              </template>
            </b-autocomplete>
            <p class="control">
              <button
                type="button"
                class="button is-danger"
                @click="
                  body.shadow_circle_id = null;
                  body.shadow_circle = null;
                "
                v-if="body.shadow_circle"
              >{{ body.shadow_circle.name }} (Click to unset)</button
              >
              <span class="button is-static" v-if="!body.shadow_circle">Not set.</span>
            </p>
          </div>
          <p class="help is-danger" v-if="errors.shadow_circle_id">
            {{ errors.shadow_circle_id.join(', ') }}
          </p>
        </div>

        <b-loading :is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input
              type="submit"
              value="Save body"
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
    // Creating a body needs the global right to create bodies, which also gives every field.
    // When editing, the fields that need the global right to update bodies stay locked until
    // the permissions say otherwise.
    const creating = !this.$route.params.id
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
        editName: creating,
        editAbbreviation: creating,
        editCode: creating,
        editShadowCircle: creating,
        editType: creating,
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
      return this.body.circles.filter((circle) => circle.name.toLowerCase().includes((this.autocompleteBody || '').toLowerCase()))
    }
  },
  methods: {
    parseDate (date) {
      return date ? moment(date, 'YYYY-MM-DD').toDate() : null
    },
    formatDate (date) {
      return moment(date).format('YYYY-MM-DD')
    },
    transformFoundedAt () {
      this.body.founded_at = this.foundationDate ? moment(this.foundationDate).format('YYYY-MM-DD') : null
    },
    fetchPermissions () {
      this.axios
        .get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions')
        .then((response) => {
          this.permissions = response.data.data

          const editGlobalPermission = this.permissions.find((permission) => permission.combined.endsWith('global:update:body'))
          this.can.editName = editGlobalPermission
          this.can.editAbbreviation = editGlobalPermission
          this.can.editCode = editGlobalPermission
          this.can.editShadowCircle = editGlobalPermission
          this.can.editType = editGlobalPermission
          this.can.editGsuite = editGlobalPermission
        })
        .catch((err) => {
          // The fields that need the global right stay locked.
          this.$root.showError('Could not fetch your permissions for this body', err)
        })
    },
    saveBody () {
      if (
        ['antenna', 'contact antenna', 'contact'].includes(this.body.type)
        && !this.body.founded_at
      ) {
        return this.$root.showError('Please set the founding date of the local.')
      }

      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.services['core'] + '/bodies/' + this.$route.params.id, this.body)
        : this.axios.post(this.services['core'] + '/bodies/', this.body)

      promise
        .then((response) => {
          this.isSaving = false

          this.$root.showSuccess('Body is saved.')

          return this.$router.push({
            name: 'oms.bodies.view',
            params: { id: response.data.data.id }
          })
        })
        .catch((err) => {
          this.isSaving = false

          if (err.response && err.response.status === 422) {
            // validation errors
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
    this.axios
      .get(this.services['core'] + '/bodies/' + this.$route.params.id)
      .then((response) => {
        this.body = response.data.data
        this.foundationDate = response.data.data.founded_at
          ? moment(response.data.data.founded_at, 'YYYY-MM-DD').toDate()
          : null

        this.isLoading = false
        this.fetchPermissions()
      })
      .catch((err) => {
        if (err.response && err.response.status === 404) {
          this.$root.showError('Body is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }

        this.$router.push({ name: 'oms.bodies.list' })
      })
  }
}
</script>
