<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Join requests</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
          </div>
        </div>

        <div class="tile">
          <div class="tile is-vertical is-2" v-for="member in members" v-bind:key="member.id">

            <div class="tile is-child">
              <div class="image is-1by1">
                <img src="https://bulma.io/images/placeholders/480x480.png" alt="" />
              </div>
            </div>

            <div class="tile">
              <strong class="has-text-centered">{{ member.member.first_name }} {{ member.member.last_name }}</strong>
            </div>

            <div class="tile">
              <p class="has-text-centered">{{ member.motivation }}</p>
            </div>

            <div class="tile">
              <div class="field" v-if="!member.approved">
                <div class="control">
                  <a class="button is-info" @click="askSetMemberApproved(member, true)">
                    <span class="icon"><i class="fa fa-plus"></i></span>
                    <span>Approve</span>
                  </a>
                  <a class="button is-danger" @click="askSetMemberApproved(member, false)">
                    <span class="icon"><i class="fa fa-minus"></i></span>
                    <span>Reject</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="tile is-vertical is-12 is-child" v-if="members.length === 0 && !isLoading">
            <h1 class="subtitle has-text-centered">No join requests for this body.</h1>
          </div>
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
import services from '../../../services.json'

export default {
  name: 'JoinRequestsList',
  data () {
    return {
      members: [],
      isLoading: false,
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
      return queryObj
    }
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
      this.axios.post(services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/join_requests/' + member.id, {
        approved
      }).then((response) => {
        this.$toast.open({
          message: 'Join request is ' + (approved ? 'approved' : 'rejected') + '.',
          type: 'is-success'
        })
        if (approved) {
          member.approved = true
        } else {
          const index = this.members.findIndex(m => m.id === member.id)
          this.members.splice(index, 1)
        }
      }).catch((err) => this.$toast.open({
        duration: 3000,
        message: 'Could not process join request: ' + err.message,
        type: 'is-danger'
      }))
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

      this.axios.get(services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/join_requests', {
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

        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch join requests: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
