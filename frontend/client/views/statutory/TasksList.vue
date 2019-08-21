<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Statutory background tasks</div>

        <b-table :data="tasks" :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="type" label="type" >
              {{ props.row.type }}
            </b-table-column>

            <b-table-column field="action" label="action" >
              {{ props.row.action }}
            </b-table-column>

            <b-table-column field="objectId" label="objectId" >
              {{ props.row.objectId }}
            </b-table-column>

            <b-table-column field="time" label="time" >
              {{ props.row.time | datetimeseconds }}
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'StatutoryTasksList',
  data () {
    return {
      tasks: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/tasks/').then((event) => {
      this.tasks = event.data.data

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false

      this.$root.showDanger('Some error happened: ' + err.message)
    })
  }
}
</script>
