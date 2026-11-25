<template>
  <div class="modal-card" style="width: 90%; max-width: 1200px;">
    <header class="modal-card-head">
      <p class="modal-card-title">Fee payments for {{ member.user.first_name }} {{ member.user.last_name }}</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <b-table :data="member.payments" v-if="member.payments && member.payments.length > 0">
        <b-table-column field="id" label="#" numeric sortable v-slot="props">
          {{ props.row.id }}
        </b-table-column>

        <b-table-column field="inserted_at" label="Starts at" v-slot="props">
          {{ props.row.starts }}
        </b-table-column>

        <b-table-column field="expires" label="Expires on" v-slot="props">
          {{ props.row.expires }}
        </b-table-column>

        <b-table-column field="amount" label="Amount" v-slot="props">
          {{ props.row.amount }}
        </b-table-column>

        <b-table-column field="currency" label="Currency" v-slot="props">
          {{ props.row.currency }}
        </b-table-column>

        <b-table-column field="invoice_address" label="Invoice address" v-slot="props">
          {{ props.row.invoice_address }}
        </b-table-column>

        <b-table-column field="invoice_name" label="Invoice name" v-slot="props">
          {{ props.row.invoice_name }}
        </b-table-column>

        <b-table-column label="Delete" centered :visible="canDelete" v-slot="props">
          <button type="button" class="button is-small is-danger" @click="askDeleteMemberPaymentFee(props.row)">
            <span class="icon"><font-awesome-icon icon="minus" /></span>
            <span>Delete</span>
          </button>
        </b-table-column>

        <template slot="empty">
          <empty-table-stub />
        </template>
      </b-table>
      <template v-else>
        <empty-table-stub />
      </template>
    </section>
    <footer class="modal-card-foot" />
  </div>
</template>

<script>
import escapeHtml from 'src/methods/escape-html'

export default {
  name: 'ListFeePaymentsModal',
  props: [
    'member',
    'canDelete',
    'route',
    'services',
    'root'
  ],
  methods: {
    askDeleteMemberPaymentFee (fee) {
      const payment = `${fee.amount} ${fee.currency} (${fee.starts} to ${fee.expires})`
      const message = `Are you sure you want to <b>delete</b> the payment of ${escapeHtml(payment)} from ${escapeHtml(this.member.user.first_name + ' ' + this.member.user.last_name)}? This action cannot be undone.`

      this.$buefy.dialog.confirm({
        title: 'Deleting a fee',
        message,
        confirmText: 'Delete fee',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteFee(fee)
      })
    },
    deleteFee (fee) {
      this.axios.delete(this.services['core'] + '/bodies/' + this.route.params.id + '/payments/' + fee.id).then(() => {
        this.root.showSuccess('Fee is deleted.')
        const updatedPayments = [...this.member.payments]
        const index = updatedPayments.findIndex(p => p.id === fee.id)
        updatedPayments.splice(index, 1)
        this.member.payments = updatedPayments
      }).catch((err) => this.root.showError('Could not delete fee', err))
    }
  }
}
</script>
