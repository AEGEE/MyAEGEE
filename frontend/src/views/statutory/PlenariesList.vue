<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Plenaries list</div>

        <div class="buttons">
          <button class="button is-primary" @click="openEditPlenaryModal(null)" v-if="can.manage_plenaries">Create a plenary</button>
          <button class="button is-primary" @click="exportAll()">Export stats</button>
        </div>

        <b-table :data="plenaries" :loading="isLoading">
          <b-table-column field="id" label="#" numeric v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column field="starts" label="Starts" centered v-slot="props">
            {{ props.row.starts | datetimeseconds }}
          </b-table-column>

          <b-table-column field="starts" label="Ends" centered v-slot="props">
            {{ props.row.ends | datetimeseconds }}
          </b-table-column>

          <b-table-column label="Edit" centered v-if="can.manage_plenaries" v-slot="props">
            <button class="button is-primary is-small" @click.prevent="openEditPlenaryModal(props.row)">Edit</button>
          </b-table-column>

          <b-table-column label="Mark attendances" centered v-slot="props">
            <router-link
              :to="{ name: 'oms.statutory.plenaries.view', params: { id: $route.params.id, plenary_id: props.row.id } }"
              class="button is-small">
              View/mark attendances
            </router-link>
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
      this.$buefy.modal.open({
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
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    exportAll () {
      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/plenaries/stats/', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        const filename = 'plenaries_' + new Date().toISOString() + '.xlsx'
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/plenaries/')
    }).then((plenary) => {
      this.plenaries = plenary.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

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
