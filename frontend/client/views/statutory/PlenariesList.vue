<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Plenaries list</div>

        <div class="field" v-if="can.manage_plenaries">
          <div class="control">
            <button class="button is-primary" @click="openEditPlenaryModal(null)">Create a plenary</button>
          </div>
        </div>

        <b-table :data="plenaries" :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="name" label="Name">
              {{ props.row.name }}
            </b-table-column>

            <b-table-column field="starts" label="Starts" centered>
              {{ props.row.starts | datetimeseconds }}
            </b-table-column>

            <b-table-column field="starts" label="Ends" centered>
              {{ props.row.ends | datetimeseconds }}
            </b-table-column>

            <b-table-column label="Edit" centered v-if="can.manage_plenaries">
              <button class="button is-primary is-small" @click.prevent="openEditPlenaryModal(props.row)">Edit</button>
            </b-table-column>

            <!-- <b-table-column label="Apply" centered>
              <router-link
                :to="{ name: 'oms.statutory.candidates.new', params: { id: $route.params.id, position_id: props.row.id } }"
                class="button is-small"
                v-if="props.row.status === 'open' && !props.row.myCandidate">
                Apply!
              </router-link>
              <router-link
                :to="{ name: 'oms.statutory.candidates.edit', params: { id: $route.params.id, position_id: props.row.id, candidate_id: props.row.myCandidate.id } }"
                class="button is-small is-warning"
                v-if="props.row.status === 'open' && props.row.myCandidate">
                Edit my application!
              </router-link>
              <span v-if="props.row.status !== 'open'">You cannot apply.</span>
            </b-table-column> -->
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
import EditPlenaryModal from './EditPlenaryModal'

export default {
  name: 'StatutoryPlenariesList',
  data () {
    return {
      plenaries: [],
      event: {},
      can: {
        manage_plenaries: false,
        see_plenaries: false,
        mark_attendance: false
      },
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    openEditPlenaryModal (plenary) {
      if (!plenary) {
        plenary = {
          starts: new Date(),
          ends: new Date(),
          name: ''
        }
      }
      this.$modal.open({
        component: EditPlenaryModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          plenary,
          event: this.event,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/plenaries/')
    }).then((plenary) => {
      this.plenaries = plenary.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response && err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>

<style>
.table-wrapper .table .button:not(.is-primary) {
  color: #000;
}
.table-wrapper .table .is-selected .button, .table-wrapper .table .is-selected .tag {
  border: 1px solid white;
}
</style>