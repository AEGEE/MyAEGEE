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

        <p>Total members: {{ total }}</p>

        <b-table
          :data="members"
          :loading="isLoading">
          <b-table-column field="user.first_name" label="Name and surname" sortable v-slot="props">
            <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user.username || props.row.user.id } }">
              {{ props.row.user.first_name }} {{ props.row.user.last_name }}
            </router-link>
          </b-table-column>

          <b-table-column field="position" label="Position" v-slot="props">
            {{ props.row.position }}
          </b-table-column>

          <!-- <b-table-column field="circle_admin" label="Is circle admin?" v-slot="props">
            <span :class="{ 'tag': props.row.circle_admin, 'is-primary': props.row.circle_admin, 'is-small': props.row.circle_admin }">
              {{ props.row.circle_admin | beautify}}
            </span>
          </b-table-column> -->

          <b-table-column label="Edit" :visible="can.edit" centered v-slot="props">
            <a class="button is-small is-warning" @click="editMemberModal(props.row)">
              <span class="icon"><font-awesome-icon icon="edit" /></span>
              <span>Edit</span>
            </a>
          </b-table-column>

          <b-table-column label="Delete" :visible="can.delete" centered v-slot="props">
            <a class="button is-small is-danger" @click="askDeleteMember(props.row, false)">
              <span class="icon"><font-awesome-icon icon="minus" /></span>
              <span>Delete</span>
            </a>
          </b-table-column>

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
            @click="fetchData()">Load more members</button>
        </div>
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
      total: 0,
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
    editMemberModal (membership) {
      this.$buefy.modal.open({
        component: EditMemberPositionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          circle: { id: this.$route.params.id },
          membership,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    askDeleteMember (membership) {
      const message = 'Are you sure you want to <b>delete</b> '
        + membership.user.first_name + ' ' + membership.user.last_name
        + ' from this circle? This action cannot be undone.'

      this.$buefy.dialog.confirm({
        title: 'Deleting a member',
        message,
        confirmText: 'Delete member',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteMember(membership)
      })
    },
    deleteMember (membership) {
      this.axios.delete(this.services['core'] + '/circles/' + this.$route.params.id + '/members/' + membership.id).then(() => {
        this.$root.showSuccess('Member is deleted.')

        const index = this.members.findIndex(m => m.id === membership.id)
        this.members.splice(index, 1)
      }).catch((err) => this.$root.showError('Could not delete member', err))
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

      this.axios.get(this.services['core'] + '/circles/' + this.$route.params.id + '/members', {
        params: this.queryObject, cancelToken: this.source.token
      }).then((response) => {
        this.members = this.members.concat(response.data.data)
        this.total = response.data.meta.count
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        return this.axios.get(this.services['core'] + '/circles/' + this.$route.params.id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update_members:circle'))
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete_members:circle'))

        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch members', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
