<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">List all memberslists for {{ event.name }}</h4>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Body</th>
                <th>Currency</th>
                <th>Members amount</th>
                <th>List</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Body</th>
                <th>Currency</th>
                <th>Members amount</th>
                <th>List</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="memberslist in memberslists" v-bind:key="memberslist.body_id">
                <td>
                  <router-link :to="{ name: 'oms.bodies.view', params: { id: memberslist.body_id } }">
                    {{ memberslist.body ?  memberslist.body.name : 'Loading...' }}
                  </router-link>
                </td>
                <td>{{ memberslist.currency }}</td>
                <td>{{ memberslist.members.length }}</td>
                <td>
                  <ul>
                    <li v-for="member in memberslist.members" v-bind:key="member.user_id">
                      <router-link v-if="member.user_id" :to="{ name: 'oms.members.view', params: { id: member.user_id } }">
                        <span class="tag is-info">
                          {{ member.first_name }} {{ member.last_name }} ({{ member.fee }} {{ memberslist.currency }})
                        </span>
                      </router-link>
                      <span class="tag is-info" v-if="!member.user_id">
                        {{ member.first_name }} {{ member.last_name }} ({{ member.fee }} {{ memberslist.currency }})
                      </span>
                    </li>
                  </ul>
                </td>
              </tr>
              <tr v-show="!memberslists.length && !isLoading">
                <td colspan="4" class="has-text-centered">No memberslists uploaded.</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="4" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>
        </div>

      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ListMembersLists',
  data () {
    return {
      event: { name: '' },
      memberslists: [],
      isLoading: false
    }
  },
  computed: mapGetters(['services']),
  methods: {

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
