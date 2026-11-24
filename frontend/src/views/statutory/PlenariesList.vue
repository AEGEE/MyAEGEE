<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Plenaries list</h1>

        <div class="buttons">
          <button type="button" class="button is-primary" @click="openEditPlenaryModal(null)" v-if="can.manage_plenaries">Create a plenary</button>
          <button type="button" class="button is-primary" :class="{ 'is-loading': isExporting }" :disabled="isExporting" @click="exportAll()">Export stats</button>
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

          <b-table-column label="Edit" centered :visible="!!can.manage_plenaries" v-slot="props">
            <button type="button" class="button is-primary is-small" @click.prevent="openEditPlenaryModal(props.row)">Edit</button>
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
      isLoading: false,
      isExporting: false
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
      const isNew = !plenary
      if (isNew) {
        plenary = {
          starts: new Date(),
          ends: new Date(),
          name: ''
        }
      }
      this.$buefy.modal.open({
        component: EditPlenaryModal,
        hasModalCard: true,
        ariaLabel: isNew ? 'Add plenary' : 'Edit plenary',
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          plenary,
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        },
        events: {
          saved: () => this.reloadPlenaries()
        }
      })
    },
    loadPlenaries () {
      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/plenaries/').then((plenaries) => {
        this.plenaries = plenaries.data.data
      })
    },
    reloadPlenaries () {
      this.loadPlenaries().catch((err) => this.$root.showError('Could not load the plenaries', err))
    },
    exportAll () {
      this.isExporting = true
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
        document.body.removeChild(link)
        // Revoking it after the click is handled, so the download can start.
        setTimeout(() => window.URL.revokeObjectURL(url), 0)
        this.isExporting = false
      }).catch(async (err) => {
        // The error body is a Blob too, so reading the service's message out of it.
        if (err.response && err.response.data instanceof Blob) {
          try {
            err.response.data = JSON.parse(await err.response.data.text())
          } catch (parseError) {
            err.response.data = null
          }
        }

        this.isExporting = false
        this.$root.showError('Could not export the statistics', err)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.loadPlenaries()
    }).then(() => {
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
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

<style>
.table-wrapper .table .button:not(.is-primary) {
  color: #000;
}
.table-wrapper .table .is-selected .button, .table-wrapper .table .is-selected .tag {
  border: 1px solid white;
}
</style>
