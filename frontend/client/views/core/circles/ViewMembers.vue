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

        <b-table
          :data="members"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.member_id }}
            </b-table-column>

            <b-table-column field="first_name" label="Name and surname" sortable>
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.member.seo_url || props.row.member.id } }">
                {{ props.row.member.first_name }} {{ props.row.member.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="position" label="Position">
              {{ props.row.position }}
            </b-table-column>

            <b-table-column field="circle_admin" label="Is circle admin?">
              <span :class="{ 'tag': props.row.circle_admin, 'is-primary': props.row.circle_admin, 'is-small': props.row.circle_admin }">
                {{ props.row.circle_admin | beautify}}
              </span>
            </b-table-column>

            <b-table-column label="Edit" :visible="can.edit" centered>
              <a class="button is-small is-warning" @click="editMemberModal(props.row)">
                <span class="icon"><i class="fa fa-edit"></i></span>
                <span>Edit</span>
              </a>
            </b-table-column>

            <b-table-column label="Delete" :visible="can.delete" centered>
              <a class="button is-small is-danger" @click="askDeleteMember(props.row, false)">
                <span class="icon"><i class="fa fa-minus"></i></span>
                <span>Delete</span>
              </a>
            </b-table-column>
          </template>

          <template slot="empty">
            <section class="section">
              <div class="content has-text-grey has-text-centered">
                <p>
                  <b-icon icon="fa fa-times-circle" size="is-large"></b-icon>
                </p>
                <p>Nothing here.</p>
              </div>
            </section>
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
