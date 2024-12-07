<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Statutory background tasks</div>

        <b-table :data="tasks" :loading="isLoading">
          <b-table-column field="id" label="ID" v-slot="props">
            {{ props.row.id }}
          </b-table-column>

          <b-table-column field="key" label="key" v-slot="props">
            {{ props.row.key }}
          </b-table-column>

          <b-table-column field="description" label="description" v-slot="props">
            {{ props.row.description }}
          </b-table-column>

          <b-table-column field="params" label="params" v-slot="props">
            <span class="has-text-pre-wrap">{{ JSON.stringify(props.row.params) }}</span>
          </b-table-column>

          <b-table-column field="time" label="time" v-slot="props">
            {{ props.row.time | datetimeseconds }}
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

    this.axios.get(this.services['statutory'] + '/tasks/').then((event) => {
      this.tasks = Object.keys(event.data.data).map(key => ({
        id: key,
        ...event.data.data[key]
      }))

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false

      this.$root.showError('Some error happened', err)
    })
  }
}
</script>
