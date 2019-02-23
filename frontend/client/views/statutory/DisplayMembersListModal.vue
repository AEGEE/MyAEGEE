<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Display members list</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <b-table :data="memberslist.members">
        <template slot-scope="props">
          <b-table-column field="id" label="User ID" numeric sortable>
            {{ props.row.user_id }}
          </b-table-column>

          <b-table-column field="first_name" label="First name" sortable>
            {{ props.row.first_name }}
          </b-table-column>

          <b-table-column field="last_name" label="Last name" sortable>
            {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="fee" label="Fee" numeric sortable>
            {{ props.row.fee }} {{ memberslist.currency }}
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
    </section>
    <footer class="modal-card-foot">

    </footer>
  </div>
</template>

<script>
export default {
  name: 'DisplayMembersListModal',
  props: ['memberslist'],
  data () {
    return {

    }
  },
  methods: {

  }
}
</script>