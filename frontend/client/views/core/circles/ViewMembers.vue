<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Circle members</h4>
        <div class="field">
          <label class="label">Search</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search" @input="refetch()">
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name and surname</th>
                <th>Position</th>
                <th>Is circle admin?</th>
                <th></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name and surname</th>
                <th>Position</th>
                <th>Is circle admin?</th>
                <th></th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="members.length" v-for="(member, index) in members" v-bind:key="member.id">
                <td>
                  <router-link :to="{ name: 'oms.members.view', params: { id: member.seo_url || member.id } }">
                    {{ member.member.first_name }} {{ member.member.last_name }}
                  </router-link>
                </td>
                <td v-if="member.position">{{ member.position }}</td>
                <td v-if="!member.position"><i>No position set.</i></td>
                <td>
                  <i v-if="!member.circle_admin">No</i>
                  <strong v-if="member.circle_admin">Yes</strong>
                </td>
                <td>
                  <div class="field">
                    <div class="control">
                      <a class="button is-small is-warning" @click="selectedUserIndex = index" v-if="can.edit">
                        <span class="icon"><i class="fa fa-edit"></i></span>
                        <span>Edit</span>
                      </a>
                      <a class="button is-small is-danger" @click="askDeleteMember(member, false)"  v-if="can.delete">
                        <span class="icon"><i class="fa fa-minus"></i></span>
                        <span>Delete</span>
                      </a>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-show="!members.length && !isLoading">
                <td colspan="4" class="has-text-centered">This circle does not have any members.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!--<div class="tile">
          <div class="tile is-vertical is-2" v-for="(member, index) in members" v-bind:key="member.id">

            <div class="tile is-child">
              <div class="image is-1by1">
                <img src="https://bulma.io/images/placeholders/480x480.png" alt="" />
              </div>
            </div>

            <div class="tile">
              <strong class="has-text-centered">{{ member.member.first_name }} {{ member.member.last_name }}</strong>
            </div>

            <div class="tile">
              <p class="has-text-centered" v-if="member.position">{{ member.position }}</p>
              <p class="has-text-centered" v-if="!member.position"><i>No position set.</i></p>
            </div>

            <div class="tile" v-if="member.circle_admin">
              <p class="has-text-centered"><i>Circle admin.</i></p>
            </div>

            <div class="tile">
              <div class="field">
                <div class="control">
                  <a class="button is-warning" @click="selectedUserIndex = index" v-if="can.edit">
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
            <h1 class="subtitle has-text-centered">No members inside this circle.</h1>
          </div>
        </div>-->

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

    <div class="modal is-active" v-if="selectedUserIndex !== null">
      <div class="modal-background"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Edit user membership</p>
          <button class="delete" aria-label="close" @click="selectedUserIndex = null"></button>
        </header>
        <section class="modal-card-body">
          <div class="field" v-if="members[selectedUserIndex]">
            <label class="label">Position</label>
            <div class="control">
              <input class="input" type="text" v-model="members[selectedUserIndex].position" />
            </div>
            <p class="help is-danger" v-if="userErrors.position">{{ userErrors.position.join(', ')}}</p>
          </div>

          <div class="field" v-if="members[selectedUserIndex]">
            <label class="label">Circle admin?
              <input class="checkbox" type="checkbox" v-model="members[selectedUserIndex].circle_admin" />
            </label>
            <p class="help is-danger" v-if="userErrors.circle_admin">{{ userErrors.circle_admin.join(', ')}}</p>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-success" @click="updateMembership()">Save changes</button>
          <button class="button" @click="selectedUserIndex = null">Cancel</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'CircleMembersList',
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
      userErrors: {},
      can: {
        edit: false,
        delete: false,
        create: false
      },
      isEditing: false,
      selectedUserIndex: null
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
        ' from this circle? This action cannot be undone.'

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
      this.axios.delete(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/members/' + member.id).then((response) => {
        this.$toast.open('Member is deleted.')

        const index = this.members.findIndex(m => m.id === member.id)
        this.members.splice(index, 1)
      }).catch((err) => this.$toast.open({
        duration: 3000,
        message: 'Could not delete member: ' + err.message,
        type: 'is-danger'
      }))
    },
    updateMembership () {
      this.isLoading = true

      const member = this.members[this.selectedUserIndex]

      this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/members/' + member.id, {
        circle_membership: member
      }).then((response) => {
        this.$toast.open({
          message: 'Membership is updated',
          type: 'is-success'
        })
        this.isLoading = false
        this.selectedUserIndex = null
      }).catch((err) => {
        this.isLoading = false

        this.$toast.open({
          duration: 3000,
          message: 'Error updating user membership: ' + err.message,
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

      this.axios.get(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/members', {
        params: this.queryObject, cancelToken: this.source.token
      }).then((response) => {
        this.members = this.members.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['oms-core-elixir'] + '/circles/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update_members:circle'))
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete_members:circle'))

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
