<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Change events' statuses</h4>

        <b-table
          :data="events"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="type" label="Event type" sortable>
              {{ props.row.type }}
            </b-table-column>

            <b-table-column field="name" label="Event name" sortable>
              <router-link :to="{ name: 'oms.events.view', params: { id: props.row.url || props.row.id } }">
                {{ props.row.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="description" label="Description" sortable>
              {{ props.row.description }}
            </b-table-column>

            <b-table-column field="starts" label="Event dates" sortable>
              {{ props.row.starts | date }} - {{ props.row.ends | date }}
            </b-table-column>

            <b-table-column field="status" label="Current status" sortable>
              {{ props.row.status | capitalize }}
            </b-table-column>

            <b-table-column field="status" label="Publish" sortable>
              <button class="button is-small is-primary" @click="publishEvent(props.row)">Publish</button>
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
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ChangeEventsStatus',
  data () {
    return {
      events: [],
      isLoading: false,
      permissions: []
    }
  },
  computed: mapGetters(['services']),
  methods: {
    publishEvent (event) {
      this.axios.put(this.services['oms-events'] + '/single/' + event.id + '/status', {
        status: 'published'
      }).then(() => {
        this.$root.showSuccess('Event status is now "published".')

        this.events.splice(this.events.indexOf(event), 1)
      }).catch((err) => {
        this.$root.showDanger('Could not update event status: ' + err.message)
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['oms-events'] + '/mine/approvable').then((response) => {
        this.events = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not fetch events list: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
