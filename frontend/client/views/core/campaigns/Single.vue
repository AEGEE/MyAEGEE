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
                <span class="icon"><i class="fa fa-edit"></i></span>
              </router-link>

              <router-link  v-if="can.edit && $route.params.body_id" :to="{ name: 'oms.bodies.campaigns.edit', params: { body_id: campaign.autojoin_body_id, id: campaign.id } }" class="button is-warning">
                <span>Edit campaign details</span>
                <span class="icon"><i class="fa fa-edit"></i></span>
              </router-link>

              <button v-if="can.delete" class="button is-danger" @click="askDeleteCampaign()">
                <span>Delete campaign</span>
                <span class="icon"><i class="fa fa-times"></i></span>
              </button>
            </div>
          </article>
        </div>
      </article>

      <p class="subtitle">Submissions</p>

      <div class="field">
        <label class="label">Search by name or surname</label>
        <div class="field has-addons">
          <div class="control is-expanded">
            <input class="input" type="text" v-model="query" placeholder="Search by name or surname" />
          </div>
        </div>
      </div>

      <b-table
        :data="filteredSubmissions"
        paginated
        :per-page="limit"
        default-sort="id"
        default-sort-direction="desc">
        <template slot-scope="props">
          <b-table-column field="user.member_id" label="#" numeric sortable>
            {{ props.row.user.member_id }}
          </b-table-column>

          <b-table-column field="first_name" label="User" sortable>
            <router-link v-if="can.viewMember && props.row.mail_confirmed" :to="{ name: 'oms.members.view', params: { id: props.row.user.member_id } }">
              {{ props.row.first_name }} {{ props.row.last_name }}
            </router-link>
            <span v-else>
              {{ props.row.first_name }} {{ props.row.last_name }}
            </span>
          </b-table-column>

          <b-table-column field="motivation" label="Motivation">
            {{ props.row.motivation }}
          </b-table-column>

          <b-table-column field="mail_confirmed" label="Email confirmed?" sortable>
            <span class="tag is-small" :class="props.row.mail_confirmed ? 'is-primary' : 'is-danger'">
              {{ props.row.mail_confirmed | beautify }}
            </span>
          </b-table-column>
        </template>

        <template slot="empty">
          <empty-table-stub />
        </template>
      </b-table>
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
      query: '',
      limit: 50,
      isLoading: false,
      permissions: [],
      can: {
        edit: false,
        delete: false,
        viewMember: false
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

      const requests = [
        this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
      ]

      // If bound circle, also request local permission on the body.
      if (this.campaign.autojoin_body_id) {
        requests.push(this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.campaign.autojoin_body_id + '/my_permissions'))
      }

      return Promise.all(requests)
    }).then((responses) => {
      this.permissions = responses[0].data.data

      this.can.viewMember = responses.some(responseList => responseList.data.data.some(permission => permission.combined.endsWith('view:member')))
      this.can.edit = responses.some(responseList => responseList.data.data.some(permission => permission.combined.endsWith('update:campaign')))
      this.can.delete = responses.some(responseList => responseList.data.data.some(permission => permission.combined.endsWith('delete:campaign')))

      this.isLoading = false
    }).catch((err) => {
      let message = (err.response && err.response.status === 404) ? 'Campaign is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.campaigns.list' })
    })
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    filteredSubmissions () {
      const queryLowerCase = this.query.toLowerCase()

      return this.campaign.submissions.filter(submission => {
        return submission.first_name.toLowerCase().includes(queryLowerCase) || submission.last_name.toLowerCase().includes(queryLowerCase)
      })
    }
  }
}
</script>
