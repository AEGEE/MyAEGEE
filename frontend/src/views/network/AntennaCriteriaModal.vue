<template>
  <div class="modal-card" style="height: 75vh">
    <header class="modal-card-head">
      <p class="modal-card-title">{{ local.name }}</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <template v-if="can.setNetcomAssignment">
        <b-field label="Assigned NetCommie" label-for="ac-criteria-netcom">
          <b-select id="ac-criteria-netcom" v-model="selectedNetcom" expanded>
            <option v-for="netcommie in netcommies" v-bind:key="netcommie.user_id" :value="netcommie">{{ netcommie.first_name }}</option>
          </b-select>
        </b-field>
      </template>

      <template v-if="can.setCommunication">
        <b-field label="Communication (C)" label-for="ac-criteria-communication" />
        <b-field grouped>
          <b-select id="ac-criteria-communication" v-model="antennaCriteria.communication">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option v-if="can.setCommunicationException" value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.communication" placeholder="Comment" aria-label="Communication comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setBoardElection">
        <b-field>
          <template #label>
            <span id="ac-criteria-board-election-label">Board Election (BE)</span>
            <tooltip text="This is an automatic field" />
          </template>
        </b-field>
        <b-field grouped>
          <b-select aria-labelledby="ac-criteria-board-election-label" v-model="antennaCriteria.boardElection">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.boardElection" placeholder="Comment" aria-label="Board election comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setMembersList">
        <b-field>
          <template #label>
            <span id="ac-criteria-members-list-label">Members list (ML)</span>
            <tooltip text="This is an automatic field" />
          </template>
        </b-field>
        <b-field grouped>
          <b-select aria-labelledby="ac-criteria-members-list-label" v-model="antennaCriteria.membersList">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.membersList" placeholder="Comment" aria-label="Members list comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setMembershipFee">
        <b-field>
          <template #label>
            <span id="ac-criteria-membership-fee-label">Membership fee (F)</span>
            <tooltip text="This is an automatic field" />
          </template>
        </b-field>
        <b-field grouped>
          <b-select aria-labelledby="ac-criteria-membership-fee-label" v-model="antennaCriteria.membershipFee">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.membershipFee" placeholder="Comment" aria-label="Membership fee comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setEvents">
        <b-field>
          <template #label>
            <span id="ac-criteria-events-label">Events (E)</span>
            <tooltip text="This is an automatic field" />
          </template>
        </b-field>
        <b-field grouped>
          <b-select aria-labelledby="ac-criteria-events-label" v-model="antennaCriteria.events">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.events" placeholder="Comment" aria-label="Events comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setAgoraAttendance">
        <b-field label="Agora attendance (AA)" label-for="ac-criteria-agora-attendance" />
        <b-field grouped>
          <b-select id="ac-criteria-agora-attendance" v-model="antennaCriteria.agoraAttendance">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.agoraAttendance" placeholder="Comment" aria-label="Agora attendance comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setDevelopmentPlan">
        <b-field label="Development plan (DP)" label-for="ac-criteria-development-plan" />
        <b-field grouped>
          <b-select id="ac-criteria-development-plan" v-model="antennaCriteria.developmentPlan">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.developmentPlan" placeholder="Comment" aria-label="Development plan comment" expanded />
        </b-field>
      </template>

      <template v-if="can.setFulfilmentReport">
        <b-field label="Fulfilment report (FR)" label-for="ac-criteria-fulfilment-report" />
        <b-field grouped>
          <b-select id="ac-criteria-fulfilment-report" v-model="antennaCriteria.fulfilmentReport">
            <option value="null">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
            <option value="exception">Exception</option>
          </b-select>

          <b-input v-model="comments.fulfilmentReport" placeholder="Comment" aria-label="Fulfilment report comment" expanded />
        </b-field>
      </template>
    </section>

    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="save()">Save</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AntennaCriteriaModal',
  props: ['local', 'agora', 'netcommies', 'permissions', 'services', 'showError', 'showSuccess', 'router'],
  data () {
    return {
      antennaCriteria: {
        communication: null,
        boardElection: null,
        membersList: null,
        membershipFee: null,
        events: null,
        agoraAttendance: null,
        developmentPlan: null,
        fulfilmentReport: null
      },
      comments: {
        communication: '',
        boardElection: '',
        membersList: '',
        membershipFee: '',
        events: '',
        agoraAttendance: '',
        developmentPlan: '',
        fulfilmentReport: ''
      },
      can: {
        setNetcomAssignment: false,
        setCommunication: false,
        setCommunicationException: false,
        setBoardElection: false,
        setMembersList: false,
        setMembershipFee: false,
        setEvents: false,
        setAgoraAttendance: false,
        setDevelopmentPlan: false,
        setFulfilmentReport: false
      },
      selectedNetcom: undefined,
      isLoading: false
    }
  },
  methods: {
    async save () {
      this.isLoading = true
      const changed = []
      for (const criterion in this.antennaCriteria) {
        const permission = 'set' + criterion.charAt(0).toUpperCase() + criterion.slice(1)
        if (
          this.can[permission]
          && (
            (this.antennaCriteria[criterion] !== null && this.antennaCriteria[criterion] !== this.local.antennaCriteria[criterion])
            || (this.comments[criterion] !== '' && this.comments[criterion] !== this.local.comments[criterion])
          )
        ) {
          changed.push(criterion)
        }
      }
      const netcomChanged = this.local.netcom !== this.selectedNetcom

      const requests = changed.map(criterion => this.setAntennaCriterionFulfilment(criterion))
      if (netcomChanged) requests.push(this.setNetcommie())
      const results = await Promise.allSettled(requests)
      this.isLoading = false

      // The row shows what was saved; each error was shown by the request that failed.
      changed.forEach((criterion, index) => {
        if (results[index].status !== 'fulfilled') return
        this.$set(this.local.antennaCriteria, criterion, this.antennaCriteria[criterion])
        this.$set(this.local.comments, criterion, this.comments[criterion])
      })
      if (netcomChanged && results[results.length - 1].status === 'fulfilled') {
        this.local.netcom = this.selectedNetcom
      }
      if (results.some(result => result.status === 'rejected')) return

      this.showSuccess('Antenna Criteria fulfilment updated.')
      this.$parent.close()
    },
    setNetcommie () {
      const request = this.selectedNetcom.first_name === 'Not set'
        ? this.axios.delete(this.services['network'] + '/netcom/' + this.local.id)
        : this.axios.put(this.services['network'] + '/netcom', {
          'body_id': this.local.id,
          'netcom_id': this.selectedNetcom.user_id
        })

      return request.catch((err) => {
        this.showError('Error saving NetCom', err)
        throw err
      })
    },
    setAntennaCriterionFulfilment (criterion) {
      // Convert camelCase to seperate, lower-case words
      const criterionName = criterion.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
      console.log(criterion, this.antennaCriteria[criterion], this.comments[criterion])

      const data = {
        'agora_id': this.agora.id,
        'body_id': this.local.id,
        'antenna_criterion': criterionName,
        'value': this.antennaCriteria[criterion] === 'null' ? null : this.antennaCriteria[criterion],
        'comment': this.comments[criterion]
      }

      return this.axios.put(
        this.services['network'] + '/antennaCriteria',
        data
      ).catch((err) => {
        this.showError('Error saving Antenna Criteria', err)
        throw err
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.can.setNetcomAssignment = this.permissions.some(permission => permission.combined.endsWith('manage_network:netcom_assignment'))
    this.can.setCommunication = this.permissions.some(permission => permission.combined.endsWith('manage_network:communication'))
    this.can.setCommunicationException = this.permissions.some(permission => permission.combined.endsWith('manage_network:communication_exception'))
    this.can.setBoardElection = this.permissions.some(permission => permission.combined.endsWith('manage_network:board_election'))
    this.can.setMembersList = this.permissions.some(permission => permission.combined.endsWith('manage_network:members_list'))
    this.can.setMembershipFee = this.permissions.some(permission => permission.combined.endsWith('manage_network:membership_fee'))
    this.can.setEvents = this.permissions.some(permission => permission.combined.endsWith('manage_network:events'))
    this.can.setAgoraAttendance = this.permissions.some(permission => permission.combined.endsWith('manage_network:agora_attendance'))
    this.can.setDevelopmentPlan = this.permissions.some(permission => permission.combined.endsWith('manage_network:development_plan'))
    this.can.setFulfilmentReport = this.permissions.some(permission => permission.combined.endsWith('manage_network:fulfilment_report'))

    // Set the current fulfilment and comments
    for (const criterion in this.local.antennaCriteria) {
      this.antennaCriteria[criterion] = this.local.antennaCriteria[criterion]
      this.comments[criterion] = this.local.comments[criterion] ?? ''
    }

    this.selectedNetcom = this.netcommies.find(x => x.first_name === this.local.netcom.first_name)

    this.isLoading = false
  }
}

</script>
