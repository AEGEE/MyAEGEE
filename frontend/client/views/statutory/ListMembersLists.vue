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

            <b-table-column label="View" sortable>
              <button class="button is-small is-primary" @click="openMembersListModal(props.row)">View memberslist</button>
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
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/memberslists')
    }).then((response) => {
      this.memberslists = response.data.data

      for (const memberslist of this.memberslists) {
        memberslist.expanded = false
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + memberslist.body_id).then((response) => {
          this.$set(memberslist, 'body', response.data.data)
        }).catch(console.error)
      }
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      this.$root.showDanger('Could not fetch members lists: ' + err.message)
    })
  }
}
</script>
