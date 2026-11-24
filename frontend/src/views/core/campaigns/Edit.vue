<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveCampaign()">
        <div class="field">
          <label class="label" for="campaign-name">Name</label>
          <div class="control">
            <input id="campaign-name" class="input" type="text" required v-model="campaign.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="campaign-description">Description</label>
          <div class="control">
            <textarea id="campaign-description" class="textarea" placeholder="e.g. Hello world" required v-model="campaign.description_long" />
          </div>
          <p class="label">Preview <MarkdownTooltip /></p>
          <div class="content">
            <span v-html="$options.filters.markdown(campaign.description_long)" />
          </div>
          <p class="help is-danger" v-if="errors.description_long">{{ errors.description_long.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label" for="campaign-url">Campaign URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <span class="button is-static">/signup/</span>
              </div>
              <div class="control">
                <input id="campaign-url" class="input" type="text" required v-model="campaign.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label" for="campaign-autojoin-body">Autojoin body</label>
          <div class="field has-addons">
            <b-autocomplete
              id="campaign-autojoin-body"
              field="name"
              v-model="autocompleteBody"
              :data="filteredBodies"
              :disabled="$route.params.body_id"
              :open-on-focus="true"
              @select="body => { campaign.autojoin_body_id = body.id; campaign.autojoin_body = body }">
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
              <button
                type="button"
                class="button is-danger"
                @click="campaign.autojoin_body_id = null; campaign.autojoin_body = null"
                v-if="campaign.autojoin_body && !$route.params.body_id">
                {{ campaign.autojoin_body.name }} (Click to unset)
              </button>
              <span class="button is-static" v-if="campaign.autojoin_body && $route.params.body_id">
                {{ campaign.autojoin_body.name }}
              </span>
              <span class="button is-static" v-if="!campaign.autojoin_body">Not set.</span>
            </p>
          </div>
          <p class="help is-danger" v-if="errors.autojoin_body_id">{{ errors.autojoin_body_id.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Active?
            <input type="checkbox" v-model="campaign.active" :disabled="!$route.params.id" />
          </label>
          <p class="help is-danger" v-if="errors.active">{{ errors.active.join(', ')}}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          The newly created recruitment campaign should be active.
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save campaign" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import MarkdownTooltip from '../../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MarkdownTooltip
  },
  name: 'EditCampaign',
  data () {
    return {
      campaign: {
        name: '',
        description_long: '',
        id: null,
        autojoin_body_id: null,
        autojoin_body: null,
        active: true
      },
      bodies: [],
      // The text typed into the body picker.
      autocompleteBody: '',
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveCampaign () {
      this.isSaving = true
      this.errors = {}

      const promise = this.$route.params.id
        ? this.axios.put(this.campaignsUrl + '/' + this.$route.params.id, this.campaign)
        : this.axios.post(this.campaignsUrl, this.campaign)

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Campaign is saved.')

        return this.$router.push({
          name: this.$route.params.body_id ? 'oms.bodies.campaigns.view' : 'oms.campaigns.view',
          params: { id: response.data.data.id, body_id: response.data.data.autojoin_body_id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response && err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the campaign data is invalid.')
        }

        this.$root.showError('Could not save campaign', err)
      })
    }
  },
  computed: {
    filteredBodies () {
      const typed = (this.autocompleteBody || '').toLowerCase()
      return this.bodies.filter((body) => body.name.toLowerCase().includes(typed))
    },
    // The campaigns of the body of the route are saved through that body.
    campaignsUrl () {
      return this.$route.params.body_id
        ? this.services['core'] + '/bodies/' + this.$route.params.body_id + '/campaigns'
        : this.services['core'] + '/campaigns'
    },
    ...mapGetters(['services'])
  },
  mounted () {
    this.axios.get(this.services['core'] + '/bodies/', { params: { limit: 1000 } }).then((response) => { // TODO rethink
      this.bodies = response.data.data

      if (this.$route.params.body_id) {
        this.campaign.autojoin_body_id = parseInt(this.$route.params.body_id, 10)
        this.campaign.autojoin_body = this.bodies.find(body => body.id === this.campaign.autojoin_body_id)
      }
    }).catch((err) => {
      this.$root.showError('Could not fetch bodies list', err)
    })

    if (!this.$route.params.id) {
      return // if creating new campaign
    }

    this.isLoading = true
    this.axios.get(this.campaignsUrl + '/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Campaign is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.campaigns.list' })
    })
  }
}
</script>
