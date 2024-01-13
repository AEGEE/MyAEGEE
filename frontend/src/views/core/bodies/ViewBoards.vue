<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Boards</h4>

        <template v-if="boards.length > 0">
          <template v-for="(board, index) in boards">
            <b-collapse class="card" animation="slide" :open="false" v-bind:key="index">
              <template #trigger="props">
                <div class="card-header" role="button">
                  <p class="card-header-title" v-if="!board.name">
                    {{ board.start_date }} - {{ board.end_date }}
                  </p>
                  <p class="card-header-title" v-else>
                    {{ board.name }} ({{ board.start_date }} - {{ board.end_date }})
                  </p>
                  <a class="card-header-icon">
                    <span class="icon is-small is-angle">
                      <font-awesome-icon :icon="['fa', 'angle-down']" v-if="!props.open" />
                      <font-awesome-icon :icon="['fa', 'angle-up']" v-else />
                    </span>
                  </a>
                </div>
              </template>

              <div class="card-content">
                <div class="content">
                  <table class="table is-narrow">
                    <tbody>
                      <tr>
                        <th>President</th>
                        <td>{{ board.president_user ? board.president_user.first_name : 'Deleted' }} {{ board.president_user ? board.president_user.last_name : 'User' }}</td>
                      </tr>
                      <tr>
                        <th>Secretary</th>
                        <td>{{ board.secretary_user ? board.secretary_user.first_name : 'Deleted' }} {{ board.secretary_user ? board.secretary_user.last_name : 'User' }}</td>
                      </tr>
                      <tr>
                        <th>Treasurer</th>
                        <td>{{ board.treasurer_user ? board.treasurer_user.first_name : 'Deleted' }} {{ board.treasurer_user ? board.treasurer_user.last_name : 'User' }}</td>
                      </tr>
                      <tr v-for="position in board.other_members" v-bind:key="position.index">
                        <th>{{ position.function }}</th>
                        <td>{{ position.user ? position.user.first_name : 'Deleted' }} {{ position.user ? position.user.last_name : 'User' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <footer class="card-footer" v-if="can.manageBoards">
                <a @click="openChangeBoardModal(index)" :class="['button', 'is-fullwidth', 'is-info']">
                  <span class="field-label">Edit board</span>
                </a>
              </footer>
            </b-collapse>
            <br v-bind:key="index" /> <!-- just here to give the cards some nicer spacing -->
          </template>
        </template>

        <template v-else>
          <empty-table-stub />
        </template>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import ChangeBoardModal from './ChangeBoardModal'

export default {
  name: 'BodyBoardsList',
  data () {
    return {
      boards: [],
      isLoading: false,
      permissions: [],
      can: {
        manageBoards: false
      }
    }
  },
  computed: {
    queryObject () {
      return this.query ? { query: this.query } : {}
    },
    ...mapGetters({
      services: 'services'
    })
  },
  methods: {
    openChangeBoardModal (index) {
      this.$buefy.modal.open({
        component: ChangeBoardModal,
        hasModalCard: true,
        props: {
          edit: true,
          oldBoard: this.boards[index],
          body: this.$route.params,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    fetchData () {
      // Get boards of the body
      this.axios.get(this.services['network'] + '/bodies/' + this.$route.params.id + '?sort=start_date&direction=desc').then((response) => {
        this.boards = response.data.data

        // Get members of the body
        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/members')
      }).then((memberResponse) => {
        const members = memberResponse.data.data
        const users = []
        for (const member of members) {
          users.push(member.user)
        }

        // Match members of a body to members on the board
        for (const board of this.boards) {
          this.$set(board, 'president_user', users.find(user => user.id === board.president))
          this.$set(board, 'secretary_user', users.find(user => user.id === board.secretary))
          this.$set(board, 'treasurer_user', users.find(user => user.id === board.treasurer))

          for (const position of board.other_members) {
            this.$set(position, 'user', users.find(user => user.id === position.user_id))
          }
        }
      }).catch((err) => {
        if (err.response.status === 404) {
          return
        }
        this.$root.showError('Could not fetch boards', err)
      })
    }
  },
  mounted () {
    this.isLoading = true
    this.fetchData()

    this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions').then((permissionResponse) => {
      this.permissions = permissionResponse.data.data
      this.can.manageBoards = this.permissions.some(permission => permission.combined.endsWith('manage_network:boards'))
    })

    this.isLoading = false
  }
}
</script>
