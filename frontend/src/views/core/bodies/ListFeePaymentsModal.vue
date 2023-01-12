<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">List view payments</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <b-table :data="member.payments">
        <template slot-scope="props">
          <b-table-column field="id" label="#" numeric sortable>
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="inserted_at" label="Starts at">
            {{ props.row.starts }}
          </b-table-column>

          <b-table-column field="expires" label="Expires on">
            {{ props.row.expires }}
          </b-table-column>

          <b-table-column field="amount" label="Amount">
            {{ props.row.amount }}
          </b-table-column>

          <b-table-column field="currency" label="Currency">
            {{ props.row.currency }}
          </b-table-column>

          <b-table-column field="invoice_address" label="Invoice address">
            {{ props.row.invoice_address }}
          </b-table-column>

          <b-table-column field="invoice_name" label="Invoice name">
            {{ props.row.invoice_name }}
          </b-table-column>
        </template>

        <template slot="empty">
          <empty-table-stub />
        </template>
      </b-table>
    </section>
    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'ListFeePaymentsModal',
  props: ['member'],
  data () {
    return {

    }
  },
  methods: {

  }
}
</script>
