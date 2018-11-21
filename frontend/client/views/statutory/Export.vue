<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Export data</div>

        <div class="field">
          <div class="control">
            <button @click="exportOpenSlides()" class="button is-primary">
              Export OpenSlides data
            </button>
          </div>
        </div>

        <div class="notification is-info">
            Keep in mind that the passwords for OpenSlides are generated at the runtime.
            If you'll export this data 2 times, you'll get 2 different set of passwords.
            Therefore it's more reasonable to do it only when you'll have the participants list finalized.
        </div>

        <hr />

        <div class="field">
          <div class="control">
            <button @click="exportAll()" class="button is-primary">
              Export participants data
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ExportStatutoryData',
  data () {
    return {
      applications: [],
      event: {
        name: ''
      }
    }
  },
  computed:  mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  methods: {
    exportOpenSlides() {
      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/export/openslides', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'openslides.csv');
        document.body.appendChild(link);
        link.click();
      })
    },
    exportAll() {
      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/export/all', {
        responseType: 'blob'
      }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'participants.xlsx');
        document.body.appendChild(link);
        link.click();
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
