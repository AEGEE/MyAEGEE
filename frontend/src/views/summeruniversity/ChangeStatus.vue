<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List of Summer Universities (SUCT)</h4>

        <b-table
          :data="events"
          :loading="isLoading">
          <b-table-column field="type" label="Event type" sortable v-slot="props">
            {{ eventTypes[props.row.type] }}
          </b-table-column>

          <b-table-column field="name" label="Event name" sortable v-slot="props">
            <router-link
              :to="{ name: 'oms.summeruniversity.view', params: { id: props.row.url || props.row.id } }"
              class="has-word-break">
              {{ props.row.name }}
            </router-link>
          </b-table-column>

          <b-table-column field="organizing_bodies" label="Organizing bodies" v-slot="props">
            <ul>
              <li v-for="body in props.row.organizing_bodies" v-bind:key="body._id">
                <router-link class="tag" :to="{ name: 'oms.bodies.view', params: { id: body.body_id } }">
                  {{ body.body_name }}
                </router-link>
              </li>
            </ul>
          </b-table-column>

          <b-table-column field="starts" label="Event dates" sortable v-slot="props">
            {{ props.row.starts | date }} - {{ props.row.ends | date }}
          </b-table-column>

          <b-table-column field="status" label="Current status" sortable v-slot="props">
            {{ props.row.status | capitalize }}
          </b-table-column>

          <b-table-column field="published" label="Current publication" sortable v-slot="props">
            {{ props.row.published | capitalize }}
          </b-table-column>

          <b-table-column field="application_status" label="Current application status" sortable v-slot="props">
            {{ props.row.application_status | capitalize }}
          </b-table-column>

          <b-table-column field="status" label="Change status" sortable v-slot="props">
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
                v-if="props.row.status === 'second approval'"
                class="button is-small is-warning"
                @click="changeStatus(props.row, 'covid submission')">
                Submit covid draft
              </button>
              <button
                v-if="props.row.status === 'covid draft'"
                class="button is-small is-warning"
                @click="changeStatus(props.row, 'covid submission')">
                Submit covid draft
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
                v-if="props.row.status === 'covid submission'"
                class="button is-small is-primary"
                @click="changeStatus(props.row, 'covid approval')">
                Approve covid submission
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
              <button
                v-if="props.row.status === 'covid submission'"
                class="button is-small is-danger"
                @click="changeStatus(props.row, 'covid draft')">
                Reject covid submission
              </button>
            </div>
          </b-table-column>

          <b-table-column field="published" label="Change publication" sortable v-slot="props">
            <div class="buttons">
              <button
                v-if="props.row.published === 'none'"
                class="button is-small is-info"
                @click="changePublication(props.row, 'minimal')">
                Publish minimal event
              </button>
              <button
                v-if="props.row.published === 'minimal'"
                class="button is-small is-info"
                @click="changePublication(props.row, 'full')">
                Publish full event
              </button>
              <button
                v-if="props.row.published === 'full'"
                class="button is-small is-info"
                @click="changePublication(props.row, 'covid')">
                Publish covid event
              </button>
              <button
                v-if="props.row.published !== 'none'"
                class="button is-small is-danger"
                @click="changePublication(props.row, 'none')">
                Unpublish event
              </button>
            </div>
          </b-table-column>

          <b-table-column field="application_status" label="Change application deadline" sortable v-slot="props">
            <div class="buttons">
              <button
                class="button is-small is-info"
                @click="askChangeApplicationPeriod(props.row)">
                Change application deadline
              </button>
            </div>
          </b-table-column>

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
    changePublication (event, newPublication) {
      this.axios.put(this.services['summeruniversity'] + '/single/' + event.id + '/published', {
        published: newPublication
      }).then(() => {
        this.$root.showSuccess(`Event publication is now "${newPublication}".`)

        event.published = newPublication
      }).catch((err) => {
        this.$root.showError('Could not update event publication', err)
      })
    },
    askChangeApplicationPeriod (event) {
      this.$buefy.dialog.prompt({
        message: 'Change application deadline (UTC)',
        inputAttrs: {
          type: 'datetime-local',
          required: true,
          placeholder: 'Change application deadline'
        },
        trapFocus: true,
        onConfirm: (newApplicationEnds) => this.changeApplicationPeriod(event, newApplicationEnds)
      })
    },
    changeApplicationPeriod (event, newApplicationEnds) {
      this.axios.put(this.services['summeruniversity'] + '/single/' + event.id + '/application_period', {
        application_ends: newApplicationEnds
      }).then(() => {
        this.$root.showSuccess(`Event application deadline is now "${newApplicationEnds}".`)
      }).catch((err) => {
        this.$root.showError('Could not update event application deadline', err)
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
