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
              <tr v-show="members.length" v-for="member in members" v-bind:key="member.id">
                <td>
                  <router-link :to="{ name: 'oms.members.view', params: { id: member.member.seo_url || member.member.id } }">
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
                      <a class="button is-small is-warning" @click="editMemberModal(member)" v-if="can.edit">
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
import EditMemberPositionModal from './EditMemberPositionModal.vue'

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
      can: {
        edit: false,
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
    editMemberModal (member) {
      this.$modal.open({
        component: EditMemberPositionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          circle: { id: this.$route.params.id },
          member,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
      })
    },
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
        this.$root.showSuccess('Member is deleted.')

        const index = this.members.findIndex(m => m.id === member.id)
        this.members.splice(index, 1)
      }).catch((err) => this.$root.showDanger('Could not delete member: ' + err.message))
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

        this.$root.showDanger('Could not fetch members: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
