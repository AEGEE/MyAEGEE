<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">List view payments</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
    <table class="table is-narrow is-fullwidth">
      <thead>
        <tr>
          <th>Added at</th>
          <th>Expires on</th>
          <th>Value</th>
          <th>Currency</th>
        </tr>
      </thead>
      <tbody>
        <b-table :data="member.payments">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="inserted_at" label="Added at">
              {{ props.row.inserted_at }}
            </b-table-column>

            <b-table-column field="expires" label="Expires on">
              {{ props.row.inserted_at }}
            </b-table-column>

            <b-table-column field="amount" label="Amount">
              {{ props.row.amount }}
            </b-table-column>

            <b-table-column field="currency" label="Currency">
              {{ props.row.currency }}
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
      </tbody>
    </table>
    </section>
    <footer class="modal-card-foot">

    </footer>
  </div>
</template>

<script>
export default {
  name: 'AddBoundCircleModal',
  props: ['member', 'services', 'showSuccess', 'showDanger'],
  data () {
    return {

    }
  },
  methods: {

  }
}
</script>