<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ campaign.name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{{ campaign.name}}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>{{ campaign.description_short }}</td>
                </tr>
                <tr>
                  <th>Long description</th>
                  <td>{{ campaign.description_long }}</td>
                </tr>
                <tr>
                  <th>URL</th>
                  <td>/signup/{{ campaign.url }}</td>
                </tr>
                <tr>
                  <th>Body</th>
                  <td v-if="campaign.autojoin_body">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: campaign.autojoin_body.id } }">
                      {{ campaign.autojoin_body.name }}
                    </router-link>
                  </td>
                  <td v-if="!campaign.autojoin_body">This campaign will not create a join request to a body after signup </td>
                </tr>
                <tr>
                  <th>Activate User</th>
                  <td v-if="campaign.activate_user">User will be activated automatically after mail confirmation</td>
                  <td v-if="!campaign.activate_user">User will remain inactive even after mail confirmation</td>
                </tr>
                <tr>
                  <th>Status</th>
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
              <router-link  v-if="can.edit && !$route.params.body_id" :to="{ name: 'oms.campaigns.edit', params: { id: campaign.id } }" class="button is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><font-awesome-icon icon="edit" /></span>
              </router-link>

              <router-link  v-if="can.edit && $route.params.body_id" :to="{ name: 'oms.bodies.campaigns.edit', params: { body_id: campaign.autojoin_body_id, id: campaign.id } }" class="button is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><font-awesome-icon icon="edit" /></span>
              </router-link>

              <router-link  v-if="can.viewMembers && !$route.params.body_id" :to="{ name: 'oms.campaigns.members', params: { id: campaign.id } }" class="button">
                <span>View members</span>
                <span class="icon"><font-awesome-icon icon="users" /></span>
              </router-link>

              <router-link  v-if="can.viewMembers && $route.params.body_id" :to="{ name: 'oms.bodies.campaigns.members', params: { body_id: campaign.autojoin_body_id, id: campaign.id } }" class="button">
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

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
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
        description_short: '',
        description_long: '',
        id: null,
        url: null,
        autojoin_body_id: null,
        autojoin_body: null,
        active: null
      },
      query: '',
      limit: 50,
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
      this.axios.delete(this.services['oms-core-elixir'] + '/campaigns/' + this.$route.params.id).then(() => {
        this.$root.showSuccess('Campaign is deleted.')
        this.$router.push({ name: 'oms.campaigns.list' })
      }).catch((err) => this.$root.showError('Could not delete campaign', err))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/campaigns/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data

      const requests = [
        this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      ]

      // If bound circle, also request local permission on the body.
      if (this.campaign.autojoin_body_id) {
        requests.push(this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.campaign.autojoin_body_id + '/my_permissions'))
      }

      return Promise.all(requests)
    }).then((responses) => {
      this.permissions = responses
        .map((response) => response.data.data)
        .flat()

      this.can.viewMembers = this.permissions.some(permission => permission.combined.endsWith('view:member'))
      this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:campaign'))
      this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:campaign'))

      this.isLoading = false
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Campaign is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.campaigns.list' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    })
  }
}
</script>
