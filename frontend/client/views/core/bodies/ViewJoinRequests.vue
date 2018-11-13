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
              <a class="button is-info" @click="displayAccepted = !displayAccepted">
                {{ this.displayAccepted ? 'Display only pending join requests' : 'Display all join requests' }}
              </a>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name and surname</th>
                <th>Motivation</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name and surname</th>
                <th>Motivation</th>
                <th>Date</th>
                <th></th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="members.length" v-for="member in members" v-bind:key="member.id" v-if="displayAccepted || !member.approved">
                <td>
                  <router-link :to="{ name: 'oms.members.view', params: { id: member.member_id } }">
                    {{ member.member.first_name }} {{ member.member.last_name }}
                  </router-link>
                </td>
                <td>{{ member.motivation }}</td>
                <td>{{ member.inserted_at | datetime }}
                <td>
                  <div class="field" v-if="!member.approved">
                    <div class="control">
                      <a class="button is-small is-info" @click="askSetMemberApproved(member, true)">
                        <span class="icon"><i class="fa fa-plus"></i></span>
                        <span>Approve</span>
                      </a>
                      <a class="button is-small is-danger" @click="askSetMemberApproved(member, false)">
                        <span class="icon"><i class="fa fa-minus"></i></span>
                        <span>Reject</span>
                      </a>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-show="!members.length && !isLoading">
                <td colspan="4" class="has-text-centered">No join requests for this body.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more join requests</button>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
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
      permissions: [],
      can: {
        create: false
      }
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

      this.$dialog.confirm({
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

        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$root.showDanger('Could not fetch join requests: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
