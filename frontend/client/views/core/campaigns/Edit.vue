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
                  v-if="campaign.autojoin_body">{{ campaign.autojoin_body.name }} (Click to unset)</a>
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

      let promise = this.$route.params.id
        ? this.axios.put(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id, { campaign: this.campaign })
        : this.axios.post(this.services['oms-core-elixir'] + '/backend_campaigns/', { campaign: this.campaign })

      promise.then((response) => {
        this.isSaving = false

        this.$root.showSuccess('Campaign is saved.')

        return this.$router.push({
          name: 'oms.campaigns.view',
          params: { id: response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the campaign data is invalid.')
        }

        this.$root.showDanger('Could not save campaign: ' + err.message)
      })
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.axios.get(this.services['oms-core-elixir'] + '/bodies/', { params: { limit: 1000 } }).then((response) => { // TODO rethink
      this.bodies = response.data.data
    }).catch((err) => {
      this.$root.showDanger('Could not fetch bodies list: ' + err.message)
    })

    if (!this.$route.params.id) {
      return // if creating new campaign
    }

    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Campaign is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.campaigns.list' })
    })
  }
}
</script>
