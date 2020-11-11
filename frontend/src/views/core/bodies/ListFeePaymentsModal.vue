<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">List view payments</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <b-table :data="member.payments">
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

        <template slot="empty">
          <empty-table-stub />
        </template>
      </b-table>
    </section>
    <footer class="modal-card-foot">

    </footer>
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
