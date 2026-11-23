<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Boards</h4>

        <div class="field is-grouped" v-if="can.manageBoards">
          <div class="control">
            <button type="button" class="button is-primary" @click="openCreateBoardModal()">Add board</button>
          </div>
        </div>

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
                  <span class="card-header-icon">
                    <span class="icon is-small is-angle">
                      <font-awesome-icon :icon="['fa', 'angle-down']" v-if="!props.open" />
                      <font-awesome-icon :icon="['fa', 'angle-up']" v-else />
                    </span>
                  </span>
                </div>
              </template>

              <div class="card-content">
                <div class="content">
                  <table class="table is-narrow">
                    <tbody>
                      <tr>
                        <th>President</th>
                        <td>{{ board.president_user ? board.president_user.first_name + ' ' + board.president_user.last_name : 'Member not found' }}</td>
                      </tr>
                      <tr>
                        <th>Secretary</th>
                        <td>{{ board.secretary_user ? board.secretary_user.first_name + ' ' + board.secretary_user.last_name : 'Member not found' }}</td>
                      </tr>
                      <tr>
                        <th>Treasurer</th>
                        <td>{{ board.treasurer_user ? board.treasurer_user.first_name + ' ' + board.treasurer_user.last_name : 'Member not found' }}</td>
                      </tr>
                      <tr v-for="position in board.other_members" v-bind:key="position.index">
                        <th>{{ position.function }}</th>
                        <td>{{ position.user ? position.user.first_name + ' ' + position.user.last_name : 'Member not found' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <footer class="card-footer" v-if="can.manageBoards">
                <button type="button" @click="openChangeBoardModal(index)" :class="['button', 'is-fullwidth', 'is-info']">
                  <span class="field-label">Edit board</span>
                </button>
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
        manageBoards: false,
        deleteBoards: false
      }
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
    })
  },
  methods: {
    openCreateBoardModal () {
      this.$buefy.modal.open({
        component: ChangeBoardModal,
        hasModalCard: true,
        ariaLabel: 'Add board',
        props: {
          body: this.$route.params,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openChangeBoardModal (index) {
      this.$buefy.modal.open({
        component: ChangeBoardModal,
        ariaLabel: 'Edit board',
        hasModalCard: true,
        props: {
          edit: true,
          canDelete: this.can.deleteBoards,
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
      this.axios.get(this.services['network'] + '/bodies/' + this.$route.params.id + '/boards?sort=start_date&direction=desc').then((response) => {
        this.boards = response.data.data

        // A body without boards gets an empty list: no members to match.
        if (this.boards.length === 0) {
          return null
        }

        // Get members of the body
        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/members')
      }).then((memberResponse) => {
        if (!memberResponse) {
          return
        }

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

          for (const position of board.other_members || []) {
            this.$set(position, 'user', users.find(user => user.id === position.user_id))
          }
        }
      }).catch((err) => {
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
      // Board managers of a body edit its boards; deleting one needs the global permission.
      this.can.deleteBoards = this.permissions.some(permission => permission.combined === 'global:manage_network:boards')
    })

    this.isLoading = false
  }
}
</script>
