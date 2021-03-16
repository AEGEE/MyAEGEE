<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List of unpublished Summer Universities</h4>

        <b-table
          :data="events"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="type" label="Event type" sortable>
              {{ eventTypes[props.row.type] }}
            </b-table-column>

            <b-table-column field="name" label="Event name" sortable>
              <router-link
                :to="{ name: 'oms.summeruniversity.view', params: { id: props.row.url || props.row.id } }"
                class="has-word-break">
                {{ props.row.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="organizing_bodies" label="Organizing bodies">
              <ul>
                <li v-for="body in props.row.organizing_bodies" v-bind:key="body._id">
                  <router-link class="tag" :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                    {{ body.body_name }}
                  </router-link>
                </li>
              </ul>
            </b-table-column>

            <b-table-column field="starts" label="Event dates" sortable>
              {{ props.row.starts | date }} - {{ props.row.ends | date }}
            </b-table-column>

            <b-table-column field="status" label="Current status" sortable>
              {{ props.row.status | capitalize }}
            </b-table-column>

            <b-table-column field="status" label="Change status" sortable>
              <div class="buttons">
                <button
                  v-if="props.row.status === 'first draft'"
                  class="button is-small is-warning"
                  @click="changeStatus(props.row, 'first submission')">
                  Submit first draft
                </button>
                <button
                  v-if="props.row.status === 'first approval'"
                  class="button is-small is-warning"
                  @click="changeStatus(props.row, 'second submission')">
                  Submit second draft
                </button>
                <button
                  v-if="props.row.status === 'second draft'"
                  class="button is-small is-warning"
                  @click="changeStatus(props.row, 'second submission')">
                  Submit second draft
                </button>
                <button
                  v-if="props.row.status === 'first submission'"
                  class="button is-small is-primary"
                  @click="changeStatus(props.row, 'first approval')">
                  Approve first submission
                </button>
                <button
                  v-if="props.row.status === 'second submission'"
                  class="button is-small is-primary"
                  @click="changeStatus(props.row, 'second approval')">
                  Approve second submission
                </button>
                <button
                  v-if="props.row.status === 'first submission'"
                  class="button is-small is-danger"
                  @click="changeStatus(props.row, 'first draft')">
                  Reject first submission
                </button>
                <button
                  v-if="props.row.status === 'second submission'"
                  class="button is-small is-danger"
                  @click="changeStatus(props.row, 'second draft')">
                  Reject second submission
                </button>
              </div>
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
import constants from '../../constants'

export default {
  name: 'ChangeEventsStatus',
  data () {
    return {
      events: [],
      isLoading: false,
      permissions: [],
      eventTypes: constants.SUMMERUNIVERSITY_TYPES_NAMES
    }
  },
  computed: mapGetters(['services']),
  methods: {
    changeStatus (event, newStatus) {
      this.axios.put(this.services['summeruniversity'] + '/single/' + event.id + '/status', {
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

      this.axios.get(this.services['summeruniversity'] + '/mine/approvable').then((response) => {
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
