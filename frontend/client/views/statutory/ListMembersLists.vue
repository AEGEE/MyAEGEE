<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List all memberslists for {{ event.name }}</h4>

        <b-table
          :data="memberslists"
          :loading="isLoading">
          <template slot-scope="props">
            <b-table-column field="body" label="Body name" sortable>
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
                {{ props.row.body ?  props.row.body.name : 'Loading...' }}
              </router-link>
            </b-table-column>

            <b-table-column field="currency" label="Currency" sortable>
              {{ props.row.currency }}
            </b-table-column>

            <b-table-column field="members.length" label="Members amount" numeric sortable>
              {{ props.row.members.length }}
            </b-table-column>

            <b-table-column label="View">
              <button class="button is-small is-primary" @click="openMembersListModal(props.row)">View memberslist</button>
            </b-table-column>

            <b-table-column field="fee_to_aegee" label="Fee to AEGEE-Europe" numeric sortable>
              {{ props.row.fee_to_aegee.toFixed(2) }} EUR
            </b-table-column>

            <b-table-column field="fee_paid" label="Fee paid" numeric sortable>
              {{ props.row.fee_paid.toFixed(2) }} EUR
            </b-table-column>

            <b-table-column field="fee_not_paid" label="Fee not paid" numeric sortable>
              {{ props.row.fee_not_paid.toFixed(2) }} EUR
            </b-table-column>

            <b-table-column label="Set fee paid" sortable :visible="can.set_memberslists_fee_paid">
              <button class="button is-small is-primary" @click="askToSetFeePaid(props.row)">Set fee paid</button>
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
      this.$modal.open({
        component: DisplayMembersListModal,
        hasModalCard: true,
        props: {
          memberslist
        }
      })
    },
    askToSetFeePaid (memberslist) {
      this.$dialog.prompt({
        message: 'Set fee paid',
        inputAttrs: {
          placeholder: 'Fee paid (in EUR)',
          required: true
        },
        onConfirm: (newFee) => this.setFeePaid(newFee, memberslist)
      })
    },
    setFeePaid (newFee, memberslist) {
      this.isLoading = true
      this.axios.put(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + memberslist.body_id + '/fee_paid', {
        fee_paid: newFee
      }).then((response) => {
        this.$root.showSuccess('Fee paid is set.')
        this.isLoading = false

        memberslist.fee_paid = newFee
        memberslist.fee_not_paid = memberslist.fee_to_aegee - newFee
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not set fee paid: ' + err.message)
      })
    },
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/memberslists')
    }).then((response) => {
      this.memberslists = response.data.data

      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/')
    }).then((response) => {
      for (const memberslist of this.memberslists) {
        const body = response.data.data.find(bodyFromList => bodyFromList.id === memberslist.body_id)
        this.$set(memberslist, 'expanded', false)
        this.$set(memberslist, 'body', body)
      }

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      this.$root.showDanger('Could not fetch members lists: ' + err.message)
    })
  }
}
</script>
