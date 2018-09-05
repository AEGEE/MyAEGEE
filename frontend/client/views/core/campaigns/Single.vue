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
            <div class="field is-grouped">
              <router-link  v-if="can.edit" :to="{ name: 'oms.campaigns.edit', params: { id: campaign.id } }" class="button is-fullwidth is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><i class="fa fa-edit"></i></span>
              </router-link>

              <a v-if="can.delete" class="button is-fullwidth is-danger" @click="askDeleteCampaign()">
                <span>Delete campaign</span>
                <span class="icon"><i class="fa fa-times"></i></span>
              </a>
            </div>
          </article>
        </div>
      </article>

      <article class="tile is-child" v-if="campaign.submissions.length">
        <div class="content">
          <p class="subtitle">Submissions</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>User</th>
                  <th>Motivation</th>
                  <th>Email confirmed?</th>
                </tr>
                <tr v-for="submission in campaign.submissions" v-bind:key="submission.id">
                  <td>
                    <router-link :to="{ name: 'oms.members.view', params: { id: submission.user.member_id } }">
                      {{ submission.first_name }} {{ submission.last_name }}
                    </router-link>
                  </td>
                  <td>{{ submission.motivation }}</td>
                  <td>{{ submission.mail_confirmed }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
        submissions: [],
        autojoin_body_id: null,
        autojoin_body: null,
        active: null
      },
      isLoading: false,
      permissions: [],
      can: {
        edit: false,
        delete: false
      }
    }
  },
  methods: {
    askDeleteCampaign () {
      this.$dialog.confirm({
        title: 'Deleting a campaign',
        message: 'Are you sure you want to <b>delete</b> this campaign? This action cannot be undone.',
        confirmText: 'Delete campaign',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteCampaign()
      })
    },
    deleteCampaign () {
      this.axios.delete(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id).then((response) => {
        this.$root.showSuccess('Campaign is deleted.')
        this.$router.push({ name: 'oms.campaigns.list' })
      }).catch((err) => this.$root.showDanger('Could not delete campaign: ' + err.message))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/backend_campaigns/' + this.$route.params.id).then((response) => {
      this.campaign = response.data.data

      return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data

      this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:campaign'))
      this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:campaign'))

      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Campaign is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.campaigns.list' })
    })
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>
