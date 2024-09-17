<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Antenna Criteria Check</h4>

        <div class="field">
          <label class="label">Selected Agora</label>
          <div class="select">
            <select v-model="selectedAgora" @change="fetchData()">
              <option v-for="agora in agorae" v-bind:key="agora.id" :value="agora">{{ agora.name }}</option>
            </select>
          </div>
        </div>

        <div class="buttons">
          <a class="button is-info" v-if="showDetails" @click="toggleShowDetails()">Show basic information</a>
          <a class="button is-info" v-if="!showDetails" @click="toggleShowDetails()">Show detailed information</a>

          <a class="button is-info" v-if="hideSafeLocals" @click="toggleHideSafeLocals()">Show all Locals</a>
          <a class="button is-info" v-if="!hideSafeLocals" @click="toggleHideSafeLocals()">Show only Locals in danger</a>
        </div>
        <b-table :data="filteredBodies" :loading="isLoading" narrowed>
          <template slot-scope="props">
            <b-table-column sortable field="name" label="Body name">
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">{{ props.row.name }}</router-link>
            </b-table-column>

            <b-table-column sortable field="type" label="Type">
              {{ props.row.type | capitalize }}
            </b-table-column>

            <b-table-column sortable field="status" label="Status">
              <b-tag type="is-success" size="is-medium" v-if="props.row.status">Safe</b-tag>
              <b-tag type="is-warning" size="is-medium" v-else>Danger</b-tag>
            </b-table-column>

            <b-table-column field="communication" label="Communication (C)">
              <b-tag type="is-light" size="is-medium" v-if="!props.row.antennaCriteria.communication && props.row.type !== 'contact antenna'">Empty</b-tag>
              <b-tag type="is-link" size="is-medium" v-if="props.row.antennaCriteria.communication === 'exception' && props.row.type !== 'contact antenna'">Exception</b-tag>
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.communication === 'true' && props.row.type !== 'contact antenna'">Yes</b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="props.row.antennaCriteria.communication === 'false' && props.row.type !== 'contact antenna'">No</b-tag>
              <b-tag type="is-info" size="is-medium" v-if="props.row.type === 'contact antenna'">Else</b-tag>
            </b-table-column>

            <b-table-column field="boardElection" label="Board election (BE)">
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.boardElection && !showDetails">Yes</b-tag>
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.boardElection && showDetails">
                {{ props.row.latest_election }}
              </b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.boardElection && !showDetails && props.row.type === 'antenna'">No</b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.boardElection && showDetails && props.row.latest_election && props.row.type === 'antenna'">
                {{ props.row.latest_election }}
              </b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.boardElection && showDetails && !props.row.latest_election && props.row.type === 'antenna'">No</b-tag>
              <b-tag type="is-info" size="is-medium" v-if="!props.row.antennaCriteria.boardElection && props.row.type !== 'antenna'">Else</b-tag>
            </b-table-column>

            <b-table-column field="membersList" label="Members list (ML)">
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.membersList">Yes</b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.membersList && props.row.type !== 'contact'">No</b-tag>
              <b-tag type="is-info" size="is-medium" v-if="!props.row.antennaCriteria.membersList && props.row.type === 'contact'">Else</b-tag>
            </b-table-column>

            <b-table-column field="membershipFee" label="Membership fee (F)">
              <template v-if="!props.row.antennaCriteria.membershipFee">
                <b-tag type="is-light" size="is-medium" v-if="props.row.type !== 'contact'">Empty</b-tag>
                <b-tag type="is-info" size="is-medium" v-if="props.row.type === 'contact'">Else</b-tag>
              </template>
              <template v-else>
                <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.membershipFee === 'true'">Yes</b-tag>
                <b-tag type="is-danger" size="is-medium" v-if="props.row.antennaCriteria.membershipFee === 'false'">No</b-tag>
                <b-tag type="is-link" size="is-medium" v-if="props.row.antennaCriteria.membershipFee === 'exception'">Exception</b-tag>
              </template>
            </b-table-column>

            <b-table-column field="mostRecentEvent" label="Events (E)">
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.events && !showDetails">Yes</b-tag>
              <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.events && showDetails">
                {{ props.row.latest_event }}
              </b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.events && !showDetails && props.row.type === 'antenna'">No</b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.events && showDetails && props.row.latest_event && props.row.type === 'antenna'">
                {{ props.row.latest_event }}
              </b-tag>
              <b-tag type="is-danger" size="is-medium" v-if="!props.row.antennaCriteria.events && showDetails && !props.row.latest_event && props.row.type === 'antenna'">No</b-tag>
              <b-tag type="is-info" size="is-medium" v-if="!props.row.antennaCriteria.events && props.row.type !== 'antenna'">Else</b-tag>
            </b-table-column>

            <b-table-column field="attendance" label="Agora attendance (AA)">
              <template v-if="!props.row.antennaCriteria.agoraAttendance">
                <b-tag type="is-light" size="is-medium" v-if="props.row.type === 'antenna'">Empty</b-tag>
                <b-tag type="is-info" size="is-medium" v-if="props.row.type !== 'antenna'">Else</b-tag>
              </template>
              <template v-else>
                <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.agoraAttendance === 'true'">Yes</b-tag>
                <b-tag type="is-danger" size="is-medium" v-if="props.row.antennaCriteria.agoraAttendance === 'false'">No</b-tag>
                <b-tag type="is-link" size="is-medium" v-if="props.row.antennaCriteria.agoraAttendance === 'exception'">Exception</b-tag>
              </template>
            </b-table-column>

            <b-table-column field="development" label="Development plan (DP)">
              <template v-if="!props.row.antennaCriteria.developmentPlan">
                <b-tag type="is-light" size="is-medium" v-if="props.row.type === 'antenna'">Empty</b-tag>
                <b-tag type="is-info" size="is-medium" v-if="props.row.type !== 'antenna'">Else</b-tag>
              </template>
              <template v-else>
                <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.developmentPlan === 'true'">Yes</b-tag>
                <b-tag type="is-danger" size="is-medium" v-if="props.row.antennaCriteria.developmentPlan === 'false'">No</b-tag>
                <b-tag type="is-link" size="is-medium" v-if="props.row.antennaCriteria.developmentPlan === 'exception'">Exception</b-tag>
              </template>
            </b-table-column>

            <b-table-column field="fulfilment" label="Fulfilment report (FR)">
              <template v-if="!props.row.antennaCriteria.fulfilmentReport">
                <b-tag type="is-light" size="is-medium" v-if="props.row.type === 'antenna'">Empty</b-tag>
                <b-tag type="is-info" size="is-medium" v-if="props.row.type !== 'antenna'">Else</b-tag>
              </template>
              <template v-else>
                <b-tag type="is-success" size="is-medium" v-if="props.row.antennaCriteria.fulfilmentReport === 'true'">Yes</b-tag>
                <b-tag type="is-danger" size="is-medium" v-if="props.row.antennaCriteria.fulfilmentReport === 'false'">No</b-tag>
                <b-tag type="is-link" size="is-medium" v-if="props.row.antennaCriteria.fulfilmentReport === 'exception'">Exception</b-tag>
              </template>
            </b-table-column>

            <b-table-column>
              <b-button @click="openAntennaCriteriaInfo(props.row)" class="button is-link">
                <span class="white"><font-awesome-icon :icon="['fa', 'eye']" /></span>
              </b-button>
            </b-table-column>

            <b-table-column>
              <b-button @click="openAntennaCriteriaModal(props.row)" class="button is-warning">
                <span class="white"><font-awesome-icon :icon="['fa', 'pencil-alt']" /></span>
              </b-button>
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
import moment from 'moment'
import AntennaCriteriaModal from './AntennaCriteriaModal.vue'
import AntennaCriteriaInfo from './AntennaCriteriaInfo.vue'

export default {
  name: 'AntennaCriteriaCheck',
  data () {
    return {
      bodies: [],
      agorae: null,
      selectedAgora: null,
      showDetails: false,
      hideSafeLocals: false,
      events: [],
      statutoryEvents: [],
      summerUniversities: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    filteredBodies () {
      if (!this.hideSafeLocals) return this.bodies
      return this.bodies.filter(body => { return body.status === false })
    }
  },
  methods: {
    openAntennaCriteriaModal (row) {
      this.$buefy.modal.open({
        component: AntennaCriteriaModal,
        hasModaLCard: true,
        props: {
          local: row,
          agora: this.selectedAgora,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openAntennaCriteriaInfo (row) {
      this.$buefy.modal.open({
        component: AntennaCriteriaInfo,
        hasModalCard: true,
        props: {
          local: row,
          agora: this.selectedAgora,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    toggleShowDetails () {
      this.showDetails = !this.showDetails
    },
    toggleHideSafeLocals () {
      this.hideSafeLocals = !this.hideSafeLocals
    },
    fetchAgorae () {
      this.isLoading = true
      this.axios.get(this.services['statutory'], { params: { type: 'agora' } }).then((response) => {
        this.agorae = response.data.data
        if (this.agorae.length === 0) {
          throw new Error('no Agora data available')
        }
        // Automatically set the most recent Agora as the selected one
        this.selectedAgora = this.agorae[0]
        this.fetchData()
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch statutory data', err)
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['core'] + '/bodies').then(async (bodiesResponse) => {
        this.bodies = bodiesResponse.data.data
        this.bodies = this.bodies.filter(x => ['antenna', 'contact antenna', 'contact'].includes(x.type))
        this.bodies.forEach(body => { body.antennaCriteria = {} })

        const promises = []
        promises.push(this.checkBoardCriterium())
        promises.push(this.checkMembersList())
        promises.push(this.checkEventsCriterium())

        await Promise.all(promises)

        // Do this after the rest, to make sure it also "overrides" automatically computed fields
        await this.getAntennaCriteriaFulfilment()

        for (const body in this.bodies) {
          if (this.bodies[body].type === 'antenna') {
            this.bodies[body].status = (
              (this.bodies[body].antennaCriteria.communication === 'true' || this.bodies[body].antennaCriteria.communication === 'exception')
              && (this.bodies[body].antennaCriteria.boardElection === 'true' || this.bodies[body].antennaCriteria.boardElection === 'exception')
              && (this.bodies[body].antennaCriteria.membersList === 'true' || this.bodies[body].antennaCriteria.membersList === 'exception')
              && (this.bodies[body].antennaCriteria.membershipFee === 'true' || this.bodies[body].antennaCriteria.membershipFee === 'exception')
              && (this.bodies[body].antennaCriteria.events === 'true' || this.bodies[body].antennaCriteria.events === 'exception')
              && (this.bodies[body].antennaCriteria.agoraAttendance === 'true' || this.bodies[body].antennaCriteria.agoraAttendance === 'exception')
              && (this.bodies[body].antennaCriteria.developmentPlan === 'true' || this.bodies[body].antennaCriteria.developmentPlan === 'exception')
              && (this.bodies[body].antennaCriteria.fulfilmentReport === 'true' || this.bodies[body].antennaCriteria.fulfilmentReport === 'exception')
            )
          }
          if (this.bodies[body].type === 'contact antenna') {
            this.bodies[body].status = (
              (this.bodies[body].antennaCriteria.membersList === 'true' || this.bodies[body].antennaCriteria.membersList === 'exception')
              && (this.bodies[body].antennaCriteria.membershipFee === 'true' || this.bodies[body].antennaCriteria.membershipFee === 'exception')
            )
          }
          if (this.bodies[body].type === 'contact') {
            this.bodies[body].status = (
              (this.bodies[body].antennaCriteria.communication === 'true' || this.bodies[body].antennaCriteria.communication === 'exception')
            )
          }
        }

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch bodies', err)
      })
    },
    async fetchEvents () {
      await this.axios.get(this.services['events'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((response) => {
        this.events = response.data.data
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch event data', err)
      })
    },
    async fetchStatutoryEvents () {
      await this.axios.get(this.services['statutory'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((response) => {
        this.statutoryEvents = response.data.data
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch statutory event data', err)
      })
    },
    async fetchSummerUniversities () {
      await this.axios.get(this.services['summeruniversity'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((response) => {
        this.summerUniversities = response.data.data
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch Summer University data', err)
      })
    },
    async checkEventsCriterium () {
      const promises = []
      promises.push(this.fetchEvents())
      promises.push(this.fetchStatutoryEvents())
      promises.push(this.fetchSummerUniversities())

      await Promise.all(promises)

      // TODO: Make this code nicer and compacter ...
      for (const event of this.events) {
        for (const organizer of event.organizing_bodies) {
          const body = this.bodies.find(x => x.id === organizer.body_id)
          body.latest_event = !body.latest_event || moment(event.latest_event).isAfter(moment(body.latest_event)) ? event.latest_event : body.latest_event
        }
      }

      for (const event of this.statutoryEvents) {
        const body = this.bodies.find(x => x.id === event.body_id)
        body.latest_event = !body.latest_event || moment(event.latest_event).isAfter(moment(body.latest_event)) ? event.latest_event : body.latest_event
      }

      for (const event of this.summerUniversities) {
        for (const organizer of event.organizing_bodies) {
          const body = this.bodies.find(x => x.id === organizer.body_id)
          body.latest_event = !body.latest_event || moment(event.latest_event).isAfter(moment(body.latest_event)) ? event.latest_event : body.latest_event
        }
      }
      // ... until here

      for (const body in this.bodies) {
        // Check if the last event is in the past 2 years
        this.bodies[body].antennaCriteria.events = this.bodies[body].latest_event !== undefined && moment(this.bodies[body].latest_event).diff(moment(this.selectedAgora.ends), 'years', true) <= 2
        if (this.bodies[body].latest_event !== undefined) this.bodies[body].latest_event = moment(this.bodies[body].latest_event).format('M[/]YYYY')
      }
    },
    async checkBoardCriterium () {
      await this.axios.get(this.services['network'] + '/boards/recents', { params: { ends: this.selectedAgora.ends } }).then((boardsResponse) => {
        for (const board of boardsResponse.data.data) {
          const body = this.bodies.find(x => x.id === board.body_id)
          body.latest_election = board.latest_election
        }

        for (const body in this.bodies) {
          // Check if the current board was elected within the past year
          this.bodies[body].antennaCriteria.boardElection = this.bodies[body].latest_election !== undefined && moment(this.bodies[body].latest_election).diff(moment(this.selectedAgora.ends), 'years', true) <= 1
          if (this.bodies[body].latest_election !== undefined) this.bodies[body].latest_election = moment(this.bodies[body].latest_election).format('D[/]M[/]YYYY')
        }
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch boards data', err)
      })
    },
    async checkMembersList () {
      await this.axios.get(this.services['statutory'] + '/events/' + this.selectedAgora.id + '/memberslists/missing').then((membersListResponse) => {
        for (const body in this.bodies) {
          this.bodies[body].antennaCriteria.membersList = this.bodies[body].id in membersListResponse.data.data.map(x => x.id)
        }
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch members list data', err)
      })
    },
    async getAntennaCriteriaFulfilment () {
      await this.axios.get(this.services['network'] + '/antennaCriteria/' + this.selectedAgora.id).then((antennaCriteriaResponse) => {
        const antennaCriteriaFulfilment = antennaCriteriaResponse.data.data
        for (const criterion of antennaCriteriaFulfilment) {
          const body = this.bodies.find(x => x.id === criterion.body_id)
          body.comments = body.comments || {}
          // Convert string to camelCase
          const criterionName = criterion.antenna_criterion.replace(/(?:^\w|\s\w)/g, match => match.trim().toUpperCase()).replace(/^\w/, match => match.toLowerCase())
          body.antennaCriteria[criterionName] = criterion.value
          body.comments[criterionName] = criterion.comment
        }
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch manual Antenna Criteria fulfilment', err)
      })
    }
  },
  mounted () {
    this.fetchAgorae()
  }
}

</script>
