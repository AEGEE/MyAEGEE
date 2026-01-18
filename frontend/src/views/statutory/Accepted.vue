<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Accepted applications</div>

        <div>Total participants accepted: {{ applications.length }}</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          default-sort="statutory_id"
          default-sort-direction="desc">
          <b-table-column field="statutory_id" label="#" numeric v-slot="props">
            {{ props.row.statutory_id }}
          </b-table-column>

          <b-table-column field="first_name" label="Name" v-slot="props">
            {{ props.row.first_name }} {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
              {{ props.row.body_name }}
            </router-link>
          </b-table-column>

          <b-table-column field="participant_type" label="Participant type and order" v-slot="props">
            {{ props.row.participant_type ? `${props.row.participant_type} (${props.row.participant_order})` : '' }}
          </b-table-column>

          <b-table-column field="confirmed" label="Confirmed?" centered v-slot="props">
            <span :class="calculateClassForTag(props.row.confirmed)">
              {{ props.row.confirmed | beautify }}
            </span>
          </b-table-column>

          <b-table-column field="attended" label="Attended?" centered v-slot="props">
            <span :class="calculateClassForTag(props.row.attended)">
              {{ props.row.attended | beautify }}
            </span>
          </b-table-column>

          <b-table-column field="registered" label="Registered?" centered v-slot="props">
            <span :class="calculateClassForTag(props.row.registered)">
              {{ props.row.registered | beautify }}
            </span>
          </b-table-column>

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
  methods: {
    calculateClassForTag (value) {
      return ['tag', 'is-small', value ? 'is-primary' : 'is-danger']
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/accepted').then((application) => {
      this.applications = application.data.data.sort((a, b) => {
        const byBody = a.body_name.localeCompare(b.body_name)
        if (byBody !== 0) {
          return byBody
        }

        const byParticipantType = (a.participant_type || 'unset').localeCompare(b.participant_type || 'unset')
        if (byParticipantType !== 0) {
          return byParticipantType
        }

        return (a.participant_order || 0) - (b.participant_order || 0)
      })
      this.isLoading = false
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
