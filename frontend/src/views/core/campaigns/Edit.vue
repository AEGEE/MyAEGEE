<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveCampaign()">
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" type="text" required v-model="campaign.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description (short)</label>
          <div class="control">
            <input class="input" type="text" required v-model="campaign.description_short" />
          </div>
          <p class="help is-danger" v-if="errors.description_short">{{ errors.description_short.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Description (long)</label>
          <div class="control">
            <input class="input" type="text" v-model="campaign.description_long" />
          </div>
          <p class="help is-danger" v-if="errors.description_long">{{ errors.description_long.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Campaign URL</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/signup/</a>
              </div>
              <div class="control">
                <input class="input" type="text" required v-model="campaign.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Autojoin body</label>
          <p class="control">
            <div class="field has-addons">
              <b-autocomplete
                v-model="autocompleteCampaign"
                :data="bodies"
                :disabled="$route.params.body_id"
                open-on-focus="true"
                @select="circle => { campaign.autojoin_body_id = circle.id; campaign.autojoin_body = circle }">
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
                  @click="campaign.autojoin_body_id = null; campaign.autojoin_body = null"
                  v-if="campaign.autojoin_body && !$route.params.body_id">
                  {{ campaign.autojoin_body.name }} (Click to unset)
                </a>
                <a class="button is-static" v-if="campaign.autojoin_body && $route.params.body_id">
                  {{ campaign.autojoin_body.name }}
                </a>
                <a class="button is-static" v-if="!campaign.autojoin_body">Not set.</a>
              </p>
            </div>
          <p class="help is-danger" v-if="errors.autojoin_body_id">{{ errors.autojoin_body_id.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Auto-activate user?
            <input type="checkbox" v-model="campaign.activate_user" />
          </label>
          <p class="help is-danger" v-if="errors.activate_user">{{ errors.auto_activate.join(', ')}}</p>
        </div>

        <div class="field">
          <label class="label">Active?
            <input type="checkbox" v-model="campaign.active" :disabled="!$route.params.id"/>
          </label>
          <p class="help is-danger" v-if="errors.active">{{ errors.active.join(', ')}}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          The newly created recruitment campaign should be active.
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>

        <div class="field">
          <div class="control">
            <input type="submit" value="Save campaign" :disabled="isSaving" class="button is-primary is-fullwidth"/>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'EditCampaign',
  data () {
    return {
      campaign: {
        name: '',
        description_short: '',
        description_long: '',
        id: null,
        autojoin_body_id: null,
        autojoin_body: null,
        active: true,
        activate_user: false
      },
      bodies: [],
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
        ? this.axios.put(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id, { campaign: this.campaign })
        : this.axios.post(this.services['oms-core-elixir'] + '/backend_campaigns/', { campaign: this.campaign })

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Campaign is saved.')

        return this.$router.push({
          name: this.$route.params.body_id ? 'oms.bodies.campaigns.view' : 'oms.campaigns.view',
          params: { id: response.data.data.id, body_id: response.data.data.autojoin_body_id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the campaign data is invalid.')
        }

        this.$root.showError('Could not save campaign', err)
      })
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.axios.get(this.services['oms-core-elixir'] + '/bodies/', { params: { limit: 1000 } }).then((response) => { // TODO rethink
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
    this.axios.get(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Campaign is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.campaigns.list' })
    })
  }
}
</script>
