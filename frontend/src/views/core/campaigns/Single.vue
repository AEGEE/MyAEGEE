<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical">
      <article class="tile is-child">
        <div class="content">
          <h1 class="title">{{ campaign.name }}</h1>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th scope="row">Name</th>
                  <td>{{ campaign.name}}</td>
                </tr>
                <tr>
                  <th scope="row">Description</th>
                  <td>
                    <span v-html="$options.filters.markdown(campaign.description_long)" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">URL</th>
                  <td>/signup/{{ campaign.url }}</td>
                </tr>
                <tr>
                  <th scope="row">Body</th>
                  <td v-if="campaign.autojoin_body">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: campaign.autojoin_body.id } }">
                      {{ campaign.autojoin_body.name }}
                    </router-link>
                  </td>
                  <td v-if="!campaign.autojoin_body">This campaign will not create a join request to a body after signup </td>
                </tr>
                <tr>
                  <th scope="row">Status</th>
                  <td v-if="campaign.active">Active</td>
                  <td v-if="!campaign.active">Inactive</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="tile is-parent">
          <article class="tile is-child is-info">
            <div class="buttons">
              <router-link v-if="can.edit && !$route.params.body_id" :to="{ name: 'oms.campaigns.edit', params: { id: campaign.id } }" class="button is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><font-awesome-icon icon="edit" /></span>
              </router-link>

              <router-link v-if="can.edit && $route.params.body_id" :to="{ name: 'oms.bodies.campaigns.edit', params: { body_id: $route.params.body_id, id: campaign.id } }" class="button is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><font-awesome-icon icon="edit" /></span>
              </router-link>

              <router-link v-if="can.viewMembers && !$route.params.body_id" :to="{ name: 'oms.campaigns.members', params: { id: campaign.id } }" class="button">
                <span>View members</span>
                <span class="icon"><font-awesome-icon icon="users" /></span>
              </router-link>

              <router-link v-if="can.viewMembers && $route.params.body_id" :to="{ name: 'oms.bodies.campaigns.members', params: { body_id: $route.params.body_id, id: campaign.id } }" class="button">
                <span>View members</span>
                <span class="icon"><font-awesome-icon icon="users" /></span>
              </router-link>

              <button v-if="can.delete" class="button is-danger" @click="askDeleteCampaign()">
                <span>Delete campaign</span>
                <span class="icon"><font-awesome-icon icon="times" /></span>
              </button>
            </div>
          </article>
        </div>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SingleCampaign',
  data () {
    return {
      campaign: {
        name: '',
        description_long: '',
        id: null,
        url: null,
        autojoin_body_id: null,
        autojoin_body: null,
        active: null
      },
      isLoading: false,
      permissions: [],
      can: {
        edit: false,
        delete: false,
        viewMembers: false
      }
    }
  },
  methods: {
    askDeleteCampaign () {
      this.$buefy.dialog.confirm({
        title: 'Deleting a campaign',
        message: 'Are you sure you want to <b>delete</b> this campaign? This action cannot be undone.',
        confirmText: 'Delete campaign',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteCampaign()
      })
    },
    deleteCampaign () {
      // A campaign of a body is deleted through that body.
      const url = this.$route.params.body_id
        ? this.services['core'] + '/bodies/' + this.$route.params.body_id + '/campaigns/' + this.$route.params.id
        : this.services['core'] + '/campaigns/' + this.$route.params.id

      this.axios.delete(url).then(() => {
        this.$root.showSuccess('Campaign is deleted.')
        this.$router.push(this.listRoute)
      }).catch((err) => this.$root.showError('Could not delete campaign', err))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['core'] + '/campaigns/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data

      const requests = [
        this.axios.get(this.services['core'] + '/my_permissions')
      ]

      // If bound circle, also request local permission on the body.
      if (this.campaign.autojoin_body_id) {
        requests.push(this.axios.get(this.services['core'] + '/bodies/' + this.campaign.autojoin_body_id + '/my_permissions'))
      }

      return Promise.all(requests).then((responses) => {
        this.permissions = responses
          .map((permissionsResponse) => permissionsResponse.data.data)
          .flat()

        this.can.viewMembers = this.permissions.some(permission => permission.combined.endsWith('view:member'))
        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:campaign'))
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:campaign'))

        this.isLoading = false
      }).catch((err) => {
        // The page stays, without the actions that need permissions.
        this.isLoading = false
        this.$root.showError('Could not fetch your permissions for this campaign', err)
      })
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Campaign is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push(this.listRoute)
    })
  },
  computed: {
    // Where the member goes when the campaign is gone: the campaigns of the body of the page, or
    // all campaigns.
    listRoute () {
      return this.$route.params.body_id
        ? { name: 'oms.bodies.campaigns', params: { id: this.$route.params.body_id } }
        : { name: 'oms.campaigns.list' }
    },
    ...mapGetters(['services'])
  }
}
</script>
