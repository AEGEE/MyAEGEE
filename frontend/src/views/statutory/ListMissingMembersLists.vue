<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h1 class="title">List all missing memberslists for {{ event.name }}</h1>

        <section aria-label="Missing members lists" :aria-busy="isLoading ? 'true' : 'false'">
          <b-table
            :data="memberslists"
            :loading="isLoading">
            <b-table-column field="name" label="Body name" sortable v-slot="props">
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">
                {{ props.row.name }}
              </router-link>
            </b-table-column>

            <b-table-column field="type" label="Type" sortable v-slot="props">
              {{ props.row.type | capitalize }}
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>
        </section>
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

    // The rows are the bodies, with their name and type.
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists/missing')
    }).then((response) => {
      this.memberslists = response.data.data
      this.isLoading = false
    })
      .catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch members lists', err)
      })
  }
}
</script>
