<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Members</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
          </div>
        </div>

        <div class="field is-grouped" v-if="can.create">
          <div class="control">
            <router-link :to="{ name: 'oms.bodies.new_member', params: { id: $route.params.id } }" class="button" >Create member</router-link>
          </div>
          <div class="control">
            <router-link :to="{ name: 'oms.bodies.bulk_import', params: { id: $route.params.id } }" class="button" >Bulk import members</router-link>
          </div>
        </div>

        <div class="tile">
          <div class="tile is-vertical is-2 box" v-for="member in members" v-bind:key="member.id">

            <div class="tile is-child">
              <div class="image is-1by1">
                <img src="https://bulma.io/images/placeholders/480x480.png" alt="" />
              </div>
            </div>

            <div class="tile">
              <strong class="has-text-centered">{{ member.member.first_name }} {{ member.member.last_name }}</strong>
            </div>

            <div class="tile">
              <p class="has-text-centered" v-if="member.comment">{{ member.comment }}</p>
              <p class="has-text-centered" v-if="!member.comment"><i>No comment set.</i></p>
            </div>

            <div class="tile">
              <div class="field">
                <div class="control">
                  <a class="button is-warning" @click="askToChangeComment(member)" v-if="can.edit">
                    <span class="icon"><i class="fa fa-edit"></i></span>
                    <span>Edit</span>
                  </a>
                  <a class="button is-danger" @click="askDeleteMember(member, false)"  v-if="can.delete">
                    <span class="icon"><i class="fa fa-minus"></i></span>
                    <span>Delete</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="tile is-vertical is-12 is-child" v-if="members.length === 0 && !isLoading">
            <h1 class="subtitle has-text-centered">No members inside this body.</h1>
          </div>
        </div>

        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more members</button>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BodyMembersList',
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
        putComments: false,
        delete: false,
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
    },
    ...mapGetters(['services'])
  },
  methods: {
    askDeleteMember (member) {
      const message =
        'Are you sure you want to <b>delete</b> ' +
        member.member.first_name + ' ' + member.member.last_name +
        ' from this body? This action cannot be undone.'

      this.$dialog.confirm({
        title: 'Deleting a member',
        message,
        confirmText: 'Delete member',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteMember(member)
      })
    },
    deleteMember (member) {
      this.axios.delete(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/members/' + member.id).then((response) => {
        this.$toast.open('Member is deleted.')

        const index = this.members.findIndex(m => m.id === member.id)
        this.members.splice(index, 1)
      }).catch((err) => this.$toast.open({
        duration: 3000,
        message: 'Could not delete member: ' + err.message,
        type: 'is-danger'
      }))
    },
    askToChangeComment (member) {
      this.$dialog.prompt({
        message: 'Change comment',
        inputAttrs: {
          placeholder: 'Comment'
        },
        onConfirm: (comment) => this.changeComment(member, comment)
      })
    },
    changeComment (member, comment) {
      this.isLoading = true
      this.axios.put(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/members/' + member.id, {
        body_membership: { comment }
      }).then((response) => {
        this.$toast.open({
          message: 'Comment is set.',
          type: 'is-success'
        })
        member.comment = comment
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$toast.open({
          duration: 3000,
          message: 'Error updating user comment: ' + err.message,
          type: 'is-danger'
        })
      })
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

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/members', {
        params: this.queryObject, cancelToken: this.source.token
      }).then((response) => {
        this.members = this.members.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update_member:body'))
        this.can.putComments = this.can.edit
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete_member:body'))
        this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:member'))

        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.debug('Request cancelled.')
        }

        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch members: ' + err.message,
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
