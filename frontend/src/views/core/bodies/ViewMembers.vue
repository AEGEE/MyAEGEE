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
            <a @click="openAddMemberModal()" class="button is-primary">Add member</a>
          </div>
          <div class="control">
            <router-link :to="{ name: 'oms.bodies.new_member', params: { id: $route.params.id } }" class="button is-primary">Create member</router-link>
          </div>
          <div class="control">
            <router-link :to="{ name: 'oms.bodies.bulk_import', params: { id: $route.params.id } }" class="button is-primary">Bulk import members</router-link>
          </div>
        </div>

        <p>Total members: {{ members.length }}</p>

        <b-table
          :data="members"
          :loading="isLoading"
          paginated
          :per-page="limit"
          default-sort="user.first_name"
          default-sort-direction="asc">
          <template slot-scope="props">
            <b-table-column field="user.first_name" label="First and last name" sortable>
              <router-link :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }" v-if="can.viewMember">
                {{ props.row.user.first_name }} {{ props.row.user.last_name }}
              </router-link>
              <span v-if="!can.viewMember">
                {{ props.row.user.first_name }} {{ props.row.user.last_name }}
              </span>
            </b-table-column>

            <b-table-column field="comment" label="Comment">
              {{ props.row.comment }}
            </b-table-column>

            <b-table-column field="lastPaymentExpires" sortable label="Last payment exp. date" centered :visible="can.viewPayment && body.pays_fees">
              <span v-if="props.row.payments && props.row.payments.length > 0">{{ getLastPaymentExpiration(props.row) | date }}</span>
            </b-table-column>

            <b-table-column label="View payments" centered :visible="(can.viewPayment || can.createPayment) && body.pays_fees">
              <a class="button is-small is-primary" @click="openListFeePaymentsModal(props.row)">
                <span class="icon"><font-awesome-icon icon="dollar-sign" /></span>
                <span>View or manage payments</span>
              </a>
            </b-table-column>

            <b-table-column label="Add payment" centered :visible="can.createPayment && body.pays_fees">
              <a class="button is-small is-primary" @click="openAddFeePaymentModal(props.row)">
                <span class="icon"><font-awesome-icon icon="dollar-sign" /></span>
                <span>Add fee payment</span>
              </a>
            </b-table-column>

            <b-table-column label="Edit" centered :visible="can.edit">
              <a class="button is-small is-warning" @click="askToChangeComment(props.row)">
                <span class="icon"><font-awesome-icon icon="edit" /></span>
                <span>Edit</span>
              </a>
            </b-table-column>

            <b-table-column label="Delete" centered :visible="can.delete">
              <a class="button is-small is-danger" @click="askDeleteMember(props.row, false)">
                <span class="icon"><font-awesome-icon icon="minus" /></span>
                <span>Delete</span>
              </a>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import ListFeePaymentsModal from './ListFeePaymentsModal'
import AddFeePaymentModal from './AddFeePaymentModal'
import AddMemberModal from './AddMemberModal'

export default {
  name: 'BodyMembersList',
  data () {
    return {
      members: [],
      payments: [],
      body: { pays_fees: false },
      isLoading: false,
      query: '',
      source: null,
      permissions: [],
      can: {
        edit: false,
        delete: false,
        create: false,
        viewMember: false,
        viewPayment: false,
        createPayment: false,
        deletePayment: false
      },
      PAST_DATE_PLACEHOLDER: '1900-01-1'
    }
  },
  computed: {
    queryObject () {
      return this.query ? { query: this.query } : {}
    },
    ...mapGetters(['services'])
  },
  methods: {
    openListFeePaymentsModal (member) {
      this.$buefy.modal.open({
        component: ListFeePaymentsModal,
        hasModalCard: true,
        props: {
          member,
          payments: this.payments,
          canDelete: this.can.deletePayment,
          route: this.$route,
          services: this.services,
          root: this.$root
        }
      })
    },
    openAddFeePaymentModal (member) {
      this.$buefy.modal.open({
        component: AddFeePaymentModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          member,
          body: this.body,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    openAddMemberModal () {
      this.$buefy.modal.open({
        component: AddMemberModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          body: this.body,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    getLastPaymentExpiration (member) {
      return member.payments[member.payments.length - 1].expires
    },
    askDeleteMember (member) {
      const message = 'Are you sure you want to <b>delete</b> '
        + member.user.first_name + ' ' + member.user.last_name
        + ' from this body? This action cannot be undone.'

      this.$buefy.dialog.confirm({
        title: 'Deleting a member',
        message,
        confirmText: 'Delete member',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteMember(member)
      })
    },
    deleteMember (member) {
      this.axios.delete(this.services['core'] + '/bodies/' + this.$route.params.id + '/members/' + member.id).then(() => {
        this.$root.showSuccess('Member is deleted.')

        const index = this.members.findIndex(m => m.id === member.id)
        this.members.splice(index, 1)
      }).catch((err) => this.$root.showError('Could not delete member', err))
    },
    askToChangeComment (member) {
      this.$buefy.dialog.prompt({
        message: 'Change comment',
        inputAttrs: {
          placeholder: 'Comment'
        },
        onConfirm: (comment) => this.changeComment(member, comment)
      })
    },
    changeComment (member, comment) {
      this.isLoading = true
      this.axios.put(this.services['core'] + '/bodies/' + this.$route.params.id + '/members/' + member.id, {
        comment
      }).then(() => {
        this.$root.showSuccess('Comment is set.')
        member.comment = comment
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showError('Error updating user comment', err)
      })
    },
    refetch () {
      this.members = []
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id, {
        cancelToken: this.source.token
      }).then((response) => {
        this.body = response.data.data

        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/members', {
          params: this.queryObject,
          cancelToken: this.source.token
        })
      }).then((response) => {
        this.members = this.members.concat(response.data.data)

        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions', {
          cancelToken: this.source.token
        })
      }).then((response) => {
        this.permissions = response.data.data

        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update_member:body'))
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete_member:body'))
        this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:member'))
        this.can.viewMember = this.permissions.some(permission => permission.combined.endsWith('view:member'))
        this.can.viewPayment = this.permissions.some(permission => permission.combined.endsWith('view:payment'))
        this.can.createPayment = this.permissions.some(permission => permission.combined.endsWith('create:payment'))
        this.can.deletePayment = this.permissions.some(permission => permission.combined.endsWith('delete:payment'))

        if (!this.can.viewPayment || !this.body.pays_fees) {
          this.isLoading = false
          return
        }

        // If you can see payments, fetch them.
        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/payments', {
          cancelToken: this.source.token
        }).then((paymentsResponse) => {
          this.payments = paymentsResponse.data.data

          for (const member of this.members) {
            const paymentsForMember = this.payments
              .filter(payment => payment.user_id === member.user_id)
              .sort((a, b) => a.expires.localeCompare(b.expires))
            this.$set(member, 'payments', paymentsForMember)
          }

          this.isLoading = false
        })
      })
        .catch((err) => {
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
