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
              {{ eventTypes[props.row.type] }}
            </b-table-column>

            <b-table-column field="name" label="Event name" sortable>
              <router-link :to="{ name: 'oms.events.view', params: { id: props.row.url || props.row.id } }">
                {{ props.row.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="description" label="Description">
              <div class="content" v-html="$options.filters.markdown(props.row.description)"></div>
            </b-table-column>

            <b-table-column field="starts" label="Event dates" sortable>
              {{ props.row.starts | date }} - {{ props.row.ends | date }}
            </b-table-column>

            <b-table-column field="status" label="Current status" sortable>
              {{ props.row.status | capitalize }}
            </b-table-column>

            <b-table-column field="status" label="Change status" sortable>
              <button
                v-if="props.row.status === 'draft'"
                class="button is-small is-warning"
                @click="changeStatus(props.row, 'submitted')">
                Request approval
              </button>
              <button
                v-if="props.row.status === 'submitted'"
                class="button is-small is-primary"
                @click="changeStatus(props.row, 'published')">
                Publish
              </button>
              <button
                v-if="props.row.status === 'submitted'"
                class="button is-small is-danger"
                @click="changeStatus(props.row, 'draft')">
                Request changes
              </button>
              <button
                v-if="props.row.status === 'published'"
                class="button is-small is-danger"
                @click="changeStatus(props.row, 'submitted')">
                Unpublish
              </button>
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import constants from  '../../constants'

export default {
  name: 'ChangeEventsStatus',
  data () {
    return {
      events: [],
      isLoading: false,
      permissions: [],
      eventTypes: constants.EVENT_TYPES_NAMES
    }
  },
  computed: mapGetters(['services']),
  methods: {
    changeStatus (event, newStatus) {
      if (event.status === 'draft') {
        if (!event.budget) {
          this.$root.showError('The budget for the event is not set.')
        }

        if (!event.programme) {
          this.$root.showError('The program for the event is not set.')
        }

        if (!event.budget || !event.programme) {
          return
        }
      }

      this.axios.put(this.services['oms-events'] + '/single/' + event.id + '/status', {
        status: newStatus
      }).then(() => {
        this.$root.showSuccess(`Event status is now "${newStatus}".`)

        event.status = newStatus
      }).catch((err) => {
        this.$root.showError('Could not update event status', err)
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['oms-events'] + '/mine/approvable').then((response) => {
        this.events = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch events list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
