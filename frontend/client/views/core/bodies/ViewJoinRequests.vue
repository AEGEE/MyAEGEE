<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Join requests</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
            </div>
            <div class="control">
              <a class="button is-info" @click="displayAccepted = !displayAccepted; refetch()">
                {{ this.displayAccepted ? 'Display only pending join requests' : 'Display all join requests' }}
              </a>
            </div>
          </div>
        </div>

        <b-table :data="members" :loading="isLoading" narrowed>
          <template slot-scope="props">
            <b-table-column field="first_name" label="Name and surname" sortable>
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.member_id } }">
                {{ props.row.member.first_name }} {{ props.row.member.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="motivation" label="Motivation">
              {{ props.row.motivation }}
            </b-table-column>

            <b-table-column field="inserted_at" label="Date" sortable>
              {{ props.row.inserted_at | datetime }}
            </b-table-column>

            <b-table-column label="Approve">
              <div class="field" v-if="!props.row.approved">
                <div class="control">
                  <a class="button is-small is-info" @click="askSetMemberApproved(props.row, true)">
                    <span class="icon"><i class="fa fa-plus"></i></span>
                    <span>Approve</span>
                  </a>
                </div>
              </div>
            </b-table-column>

            <b-table-column label="Reject">
              <div class="field" v-if="!props.row.approved">
                <div class="control">
                  <a class="button is-small is-danger" @click="askSetMemberApproved(props.row, false)">
                    <span class="icon"><i class="fa fa-minus"></i></span>
                    <span>Reject</span>
                  </a>
                </div>
              </div>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more join requests</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'JoinRequestsList',
  data () {
    return {
      members: [],
      isLoading: false,
      displayAccepted: true,
      query: '',
      limit: 30,
      offset: 0,
      canLoadMore: true,
      source: null,
      permissions: []
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (this.query) queryObj.query = this.query
      if (!this.displayAccepted) queryObj.filter = { approved: false }
      return queryObj
    },
    ...mapGetters(['services'])
  },
  methods: {
    askSetMemberApproved (member, approved) {
      const title = (approved ? 'Approve' : 'Reject') + ' ' + member.member.first_name + ' ' + member.member.last_name
      const message = 'Are you sure you want to <b>' +
        (approved ? 'approve' : 'reject') +
        '</b> ' +
        member.member.first_name + ' ' + member.member.last_name + '?'
      const type = approved ? 'is-info' : 'is-danger'

      this.$buefy.dialog.confirm({
        title,
        message,
        confirmText: title,
        type,
        hasIcon: true,
        onConfirm: () => this.setMemberApproved(member, approved)
      })
    },
    setMemberApproved (member, approved) {
      this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/join_requests/' + member.id, {
        approved
      }).then((response) => {
        this.$root.showSuccess('Join request is ' + (approved ? 'approved' : 'rejected') + '.')
        if (approved) {
          member.approved = true
        } else {
          const index = this.members.findIndex(m => m.id === member.id)
          this.members.splice(index, 1)
        }
      }).catch((err) => this.$root.showDanger('Could not process join request: ' + err.message))
    },
    refetch () {
      this.members = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/join_requests', {
        params: this.queryObject, cancelToken: this.source.token
      }).then((response) => {
        this.members = this.members.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.isLoading = false
      }).catch((err) => {
        this.$root.showDanger('Could not fetch join requests: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
