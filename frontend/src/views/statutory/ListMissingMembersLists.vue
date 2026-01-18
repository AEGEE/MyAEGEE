<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List all missing memberslists for {{ event.name }}</h4>

        <b-table
          :data="memberslists"
          :loading="isLoading">
          <b-table-column field="body_name" label="Body name" sortable v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.body_id } }">
              {{ props.row.body ? props.row.body.name : 'Loading...' }}
            </router-link>
          </b-table-column>

          <b-table-column field="type" label="Type" sortable v-slot="props">
            {{ props.row.type | capitalize }}
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

export default {
  name: 'ListMissingMembersLists',
  data () {
    return {
      event: { name: 'event that is still loading...' },
      memberslists: [],
      isLoading: false
    }
  },
  computed: mapGetters(['services']),
  mounted () {
    this.isLoading = true

    let memberslists

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data
      this.can = response.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists/missing')
    }).then((response) => {
      memberslists = response.data.data

      return this.axios.get(this.services['core'] + '/bodies/')
    }).then((response) => {
      for (const memberslist of memberslists) {
        const body = response.data.data.find(bodyFromList => bodyFromList.id === memberslist.id)
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
