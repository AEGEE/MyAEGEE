<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Accepted applications</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          default-sort="id"
          default-sort-direction="desc">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="first_name" label="Name" sortable>
              {{ props.row.first_name }} {{ props.row.last_name }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" sortable>
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
                  {{ props.row.body_name }}
                </router-link>
            </b-table-column>

            <b-table-column field="participant_type" label="Participant type and order" centered sortable>
              {{ props.row.participant_type ? `${props.row.participant_type} (${props.row.participant_order})` : '' }}
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
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AcceptedStatutoryList',
  data () {
    return {
      applications: [],
      isLoading: false
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/accepted').then((application) => {
      this.applications = application.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
