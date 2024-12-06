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

          <a class="button is-info" v-if="can.sendFulfilmentEmails" @click="openAntennaCriteriaMail()">Change fulfilment email text</a>
        </div>
        <b-table :data="filteredBodies" :loading="isLoading" narrowed>
          <template slot-scope="props">
            <b-table-column sortable field="name" label="Body name">
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">{{ props.row.name }}</router-link>
            </b-table-column>

            <b-table-column sortable field="type" label="Type">
              {{ props.row.type | capitalize }}
            </b-table-column>

            <b-table-column sortable field="netcom" label="NetCom">
              {{ props.row.netcom?.first_name }}
            </b-table-column>

            <b-table-column sortable field="status" label="Status">
              <b-tag :type="statusType(props.row)" size="is-medium">{{ statusValue(props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="communication" label="Communication (C)">
              <b-tag :type="criterionTagType('communication', props.row)" size="is-medium">{{ criterionTagValue("communication", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="boardElection" label="Board election (BE)">
              <b-tag :type="criterionTagType('boardElection', props.row)" size="is-medium">{{ criterionTagValue("boardElection", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="membersList" label="Members list (ML)">
              <b-tag :type="criterionTagType('membersList', props.row)" size="is-medium">{{ criterionTagValue("membersList", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="membershipFee" label="Membership fee (F)">
              <b-tag :type="criterionTagType('membershipFee', props.row)" size="is-medium">{{ criterionTagValue("membershipFee", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="mostRecentEvent" label="Events (E)">
              <b-tag :type="criterionTagType('events', props.row)" size="is-medium">{{ criterionTagValue("events", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="attendance" label="Agora attendance (AA)">
              <b-tag :type="criterionTagType('agoraAttendance', props.row)" size="is-medium">{{ criterionTagValue("agoraAttendance", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="development" label="Development plan (DP)">
              <b-tag :type="criterionTagType('developmentPlan', props.row)" size="is-medium">{{ criterionTagValue("developmentPlan", props.row) }}</b-tag>
            </b-table-column>

            <b-table-column field="fulfilment" label="Fulfilment report (FR)">
              <b-tag :type="criterionTagType('fulfilmentReport', props.row)" size="is-medium">{{ criterionTagValue("fulfilmentReport", props.row) }}</b-tag>
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

            <b-table-column v-if="can.sendFulfilmentEmails">
              <b-button @click="openAntennaCriteriaMailSend(props.row)" class="button is-danger">
                <span class="white"><font-awesome-icon :icon="['fa', 'envelope']" /></span>
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
import AntennaCriteriaMail from './AntennaCriteriaMail.vue'
import AntennaCriteriaMailSend from './AntennaCriteriaMailSend.vue'

export default {
  name: 'AntennaCriteriaCheck',
  data () {
    return {
      bodies: [],
      netcommies: [],
      agorae: null,
      selectedAgora: null,
      showDetails: false,
      hideSafeLocals: false,
      events: [],
      statutoryEvents: [],
      summerUniversities: [],
      isLoading: false,
      isLoadingAgora: false,
      permissions: [],
      can: {
        sendFulfilmentEmails: false
      },
      antennaCriteriaMapping: {
        'contact': ['communication'],
        'contact antenna': ['communication', 'membersList', 'membershipFee'],
        'antenna': ['communication', 'boardElection', 'membersList', 'membershipFee', 'events', 'agoraAttendance', 'developmentPlan', 'fulfilmentReport']
      }
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    filteredBodies () {
      if (!this.hideSafeLocals) return this.bodies
      return this.bodies.filter(body => { return this.statusValue(body) === 'Danger' })
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
          netcommies: this.netcommies,
          permissions: this.permissions,
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
    openAntennaCriteriaMail () {
      this.$buefy.modal.open({
        component: AntennaCriteriaMail,
        hasModalCard: true,
        props: {
          agora: this.selectedAgora,
          mailComponents: this.mailComponents,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openAntennaCriteriaMailSend (row) {
      this.$buefy.modal.open({
        component: AntennaCriteriaMailSend,
        hasModalCard: true,
        props: {
          local: row,
          agora: this.selectedAgora,
          mailComponents: this.mailComponents,
          antennaCriteriaMapping: this.antennaCriteriaMapping,
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
    criterionTagType (criterion, local) {
      if (local.antennaCriteria[criterion] === 'true') return 'is-success'
      if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'exception') return 'is-link'
      if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'false') return 'is-danger'
      if (!this.antennaCriteriaMapping[local.type].includes(criterion)) return 'is-info'
      return 'is-light'
    },
    criterionTagValue (criterion, local) {
      if (this.showDetails) {
        if (criterion === 'boardElection') {
          if (local.antennaCriteria?.['boardElection'] === 'true') return local.latestElection
          if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'exception') return 'Exception'
          if (this.antennaCriteriaMapping[local.type].includes('boardElection')) return local.latestElection ?? 'No'
        }

        if (criterion === 'events') {
          if (local.antennaCriteria?.['events'] === 'true') return local.latestEvent
          if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'exception') return 'Exception'
          if (this.antennaCriteriaMapping[local.type].includes('events')) return local.latestEvent ?? 'No'
        }
      }

      if (local.antennaCriteria[criterion] === 'true') return 'Yes'
      if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'exception') return 'Exception'
      if (this.antennaCriteriaMapping[local.type].includes(criterion) && local.antennaCriteria[criterion] === 'false') return 'No'
      if (!this.antennaCriteriaMapping[local.type].includes(criterion)) return 'Else'
      return 'Empty'
    },
    statusType (local) {
      return this.antennaCriteriaMapping[local.type].every(criterion => {
        const fulfilment = local.antennaCriteria[criterion]
        return fulfilment === 'true' || fulfilment === 'exception'
      }) ? 'is-success' : 'is-warning'
    },
    statusValue (local) {
      return this.antennaCriteriaMapping[local.type].every(criterion => {
        const fulfilment = local.antennaCriteria[criterion]
        return fulfilment === 'true' || fulfilment === 'exception'
      }) ? 'Safe' : 'Danger'
    },
    fetchAgorae () {
      this.isLoadingAgora = true
      this.axios.get(this.services['statutory'], { params: { type: 'agora' } }).then((response) => {
        this.agorae = response.data.data
        if (this.agorae.length === 0) {
          throw new Error('no Agora data available')
        }
        // Automatically set the most recent Agora as the selected one
        this.selectedAgora = this.agorae[0]
        this.fetchData()
        this.isLoadingAgora = false
      }).catch((err) => {
        this.isLoadingAgora = false
        this.$root.showError('Could not fetch statutory data', err)
      })
    },
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['core'] + '/bodies').then(async (bodiesResponse) => {
        this.bodies = bodiesResponse.data.data
        this.bodies = this.bodies.filter(x => ['antenna', 'contact antenna', 'contact'].includes(x.type))
        this.bodies.forEach(body => {
          this.$set(body, 'antennaCriteria', {})
          this.$set(body, 'comments', {})
        })

        const promises = []
        promises.push(this.fetchNetcomAssignment())
        promises.push(this.checkBoardCriterium())
        promises.push(this.checkMembersListAndFeeCriteria())
        promises.push(this.checkEventsCriterium())
        promises.push(this.fetchMailComponents())

        // The allSettled() command waits for all promises to be done, so it is also 'fine' if some of them fail
        await Promise.allSettled(promises)

        // Do this after the rest, to make sure it also "overrides" automatically computed fields
        await this.getAntennaCriteriaFulfilment()

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch bodies', err)
      })
    },
    async fetchEvents () {
      await this.axios.get(this.services['events'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((eventResponse) => {
        this.events = eventResponse.data.data
      }).catch((err) => {
        this.$root.showError('Could not fetch event data', err)
      })
    },
    async fetchStatutoryEvents () {
      await this.axios.get(this.services['statutory'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((statutoryResponse) => {
        this.statutoryEvents = statutoryResponse.data.data
      }).catch((err) => {
        this.$root.showError('Could not fetch statutory event data', err)
      })
    },
    async fetchSummerUniversities () {
      await this.axios.get(this.services['summeruniversity'] + '/recents', { params: { ends: this.selectedAgora.ends } }).then((summerUniversityResponse) => {
        this.summerUniversities = summerUniversityResponse.data.data
      }).catch((err) => {
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
          if (body) {
            const latestEvent = !body.latestEvent || moment(event.latest_event).isAfter(moment(body.latestEvent))
              ? event.latest_event
              : body.latestEvent
            this.$set(body, 'latestEvent', latestEvent)
          }
        }
      }

      for (const event of this.statutoryEvents) {
        const body = this.bodies.find(x => x.id === event.body_id)
        if (body) {
          const latestEvent = !body.latestEvent || moment(event.latest_event).isAfter(moment(body.latestEvent))
            ? event.latest_event
            : body.latestEvent
          this.$set(body, 'latestEvent', latestEvent)
        }
      }

      for (const event of this.summerUniversities) {
        for (const organizer of event.organizing_bodies) {
          const body = this.bodies.find(x => x.id === organizer.body_id)
          if (body) {
            const latestEvent = !body.latestEvent || moment(event.latest_event).isAfter(moment(body.latestEvent))
              ? event.latest_event
              : body.latestEvent
            this.$set(body, 'latestEvent', latestEvent)
          }
        }
      }
      // ... until here

      // Check if the latest event is at most two years before the Agora
      for (const body of this.bodies) {
        if (body.latestEvent) {
          const diffInYears = moment(this.selectedAgora.ends).diff(moment(body.latestEvent), 'years', true)
          this.$set(body.antennaCriteria, 'events', diffInYears >= 0 && diffInYears <= 2 ? 'true' : 'false')
          body.latestEvent = moment(body.latestEvent).format('M[/]YYYY')
        }
      }
    },
    async checkBoardCriterium () {
      await this.axios.get(this.services['network'] + '/boards/recents', { params: { ends: this.selectedAgora.ends } }).then((boardsResponse) => {
        for (const board of boardsResponse.data.data) {
          const body = this.bodies.find(x => x.id === board.body_id)
          this.$set(body, 'latestElection', board.latest_election)
        }

        // Check if the current board was elected within the past year
        for (const body of this.bodies) {
          if (body.latestElection) {
            const diffInYears = moment(this.selectedAgora.ends).diff(moment(body.latestElection), 'years', true)
            this.$set(body.antennaCriteria, 'boardElection', diffInYears >= 0 && diffInYears <= 1 ? 'true' : 'false')
            body.latestElection = moment(body.latestElection).format('D[/]M[/]YYYY')
          }
        }
      }).catch((err) => {
        this.$root.showError('Could not fetch boards data', err)
      })
    },
    async checkMembersListAndFeeCriteria () {
      await this.axios.get(this.services['statutory'] + '/events/' + this.selectedAgora.id + '/memberslists').then((membersListsResponse) => {
        for (const membersList of membersListsResponse.data.data) {
          const body = this.bodies.find(x => x.id === membersList.body_id)
          this.$set(body.antennaCriteria, 'membersList', 'true')

          if (membersList.fee_not_paid === 0) {
            this.$set(body.antennaCriteria, 'membershipFee', 'true')
          }
        }
      }).catch((err) => {
        this.$root.showError('Could not fetch members list data', err)
      })
    },
    async getAntennaCriteriaFulfilment () {
      await this.axios.get(this.services['network'] + '/antennaCriteria/' + this.selectedAgora.id).then((antennaCriteriaResponse) => {
        const antennaCriteriaFulfilment = antennaCriteriaResponse.data.data
        for (const criterion of antennaCriteriaFulfilment) {
          const body = this.bodies.find(x => x.id === criterion.body_id)

          // Convert string to camelCase
          const criterionName = criterion.antenna_criterion.replace(/(?:^\w|\s\w)/g, match => match.trim().toUpperCase()).replace(/^\w/, match => match.toLowerCase())

          this.$set(body.antennaCriteria, criterionName, criterion.value)
          this.$set(body.comments, criterionName, criterion.comment)
        }
      }).catch((err) => {
        this.$root.showError('Could not fetch manual Antenna Criteria fulfilment', err)
      })
    },
    async fetchNetcom () {
      await this.axios.get(this.services['core'] + '/bodies?query=network%20commission').then(async (netcomBodyResponse) => {
        await this.axios.get(this.services['core'] + '/bodies/' + netcomBodyResponse.data.data[0].id + '/members').then((netcomMembersResponse) => {
          this.netcommies = netcomMembersResponse.data.data.map(netcommie => ({
            user_id: netcommie.user_id,
            first_name: netcommie.user.first_name,
            email: netcommie.user.email
          }))
          this.netcommies.push({ 'user_id': 0, 'first_name': 'Not set', 'email': '' })
        })
      }).catch((err) => {
        this.$root.showError('Could not fetch NetCom data', err)
      })
    },
    async fetchNetcomAssignment () {
      await this.axios.get(this.services['network'] + '/netcom').then(async (netcomResponse) => {
        const netcomAssignment = netcomResponse.data.data
        await this.fetchNetcom()

        for (const body of this.bodies) {
          const assignment = netcomAssignment.find(x => x.body_id === body.id)
          this.$set(body, 'netcom', assignment !== undefined ? this.netcommies.find(x => x.user_id === assignment.netcom_id) : this.netcommies[this.netcommies.length - 1])
        }
      }).catch((err) => {
        this.$root.showError('Could not fetch NetCom assignment', err)
      })
    },
    async fetchMailComponents () {
      await this.axios.get(this.services['network'] + '/mailComponent/' + this.selectedAgora.id).then((mailResponse) => {
        this.mailComponents = mailResponse.data.data
      }).catch((err) => {
        this.$root.showError('Could not fetch mail components', err)
      })
    }
  },
  mounted () {
    this.fetchAgorae()

    this.axios.get(this.services['core'] + '/my_permissions').then((permissionResponse) => {
      this.permissions = permissionResponse.data.data
      this.can.sendFulfilmentEmails = this.permissions.some(permission => permission.combined.endsWith('manage_network:fulfilment_email'))
    })
  }
}

</script>
