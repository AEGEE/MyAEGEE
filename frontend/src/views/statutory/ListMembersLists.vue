<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List all memberslists for {{ event.name }}</h4>

        <b-table
          :data="memberslists"
          :loading="isLoading">
          <b-table-column field="body_name" label="Body name" sortable v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
              {{ props.row.body ? props.row.body.name : 'Loading...' }}
            </router-link>
          </b-table-column>

          <b-table-column field="currency" label="Currency" sortable v-slot="props">
            {{ props.row.currency }}
          </b-table-column>

          <b-table-column field="members.length" label="Members amount" numeric sortable v-slot="props">
            {{ props.row.members.length }}
          </b-table-column>

          <b-table-column label="View" v-slot="props">
            <button class="button is-small is-primary" @click="openMembersListModal(props.row)">View memberslist</button>
          </b-table-column>

          <b-table-column field="updated_at" label="Last updated at" sortable v-slot="props">
            {{ props.row.updated_at | datetime }}
          </b-table-column>

          <b-table-column field="fee_to_aegee" label="Fee to AEGEE-Europe" numeric sortable v-slot="props">
            {{ props.row.fee_to_aegee.toFixed(2) }} EUR
          </b-table-column>

          <b-table-column field="fee_paid" label="Fee paid" numeric sortable v-slot="props">
            {{ props.row.fee_paid.toFixed(2) }} EUR
          </b-table-column>

          <b-table-column field="fee_not_paid" label="Fee not paid" numeric sortable v-slot="props">
            {{ props.row.fee_not_paid.toFixed(2) }} EUR
          </b-table-column>

          <b-table-column label="Set fee paid" sortable :visible="can.set_memberslists_fee_paid" v-slot="props">
            <button class="button is-small is-primary" @click="askToSetFeePaid(props.row)">Set fee paid</button>
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
import DisplayMembersListModal from './DisplayMembersListModal'

export default {
  name: 'ListMembersLists',
  data () {
    return {
      event: { name: 'event that is still loading...' },
      memberslists: [],
      can: {
        set_memberslists_fee_paid: false
      },
      isLoading: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    openMembersListModal (memberslist) {
      this.$buefy.modal.open({
        component: DisplayMembersListModal,
        hasModalCard: true,
        props: {
          memberslist
        }
      })
    },
    askToSetFeePaid (memberslist) {
      this.$buefy.dialog.prompt({
        message: 'Set fee paid',
        inputAttrs: {
          placeholder: 'Fee paid (in EUR)',
          required: true,
          type: 'number',
          step: 0.01
        },
        onConfirm: (newFee) => this.setFeePaid(parseFloat(newFee), memberslist)
      })
    },
    setFeePaid (newFee, memberslist) {
      this.isLoading = true
      this.axios.put(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + memberslist.body_id + '/fee_paid', {
        fee_paid: newFee
      }).then(() => {
        this.$root.showSuccess('Fee paid is set.')
        this.isLoading = false

        memberslist.fee_paid = newFee
        memberslist.fee_not_paid = memberslist.fee_to_aegee - newFee
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not set fee paid', err)
      })
    }
  },
  mounted () {
    this.isLoading = true

    let memberslists

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists')
    }).then((response) => {
      memberslists = response.data.data

      return this.axios.get(this.services['core'] + '/bodies/')
    }).then((response) => {
      for (const memberslist of memberslists) {
        const body = response.data.data.find(bodyFromList => bodyFromList.id === memberslist.body_id)
        memberslist.expanded = false
        if (body) {
          memberslist.body = body
          memberslist.body_name = body.name
        }
      }

      this.memberslists = memberslists

      this.isLoading = false
    })
      .catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch members lists', err)
      })
  }
}
</script>
