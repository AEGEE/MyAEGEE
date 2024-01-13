<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img src="/images/logo.png">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.viewMembers">
            <router-link :to="{ name: 'oms.bodies.members', params: { id: body.id } }" :class="['button', 'is-fullwidth']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'users']" /></span>
              <span class="field-label">Members</span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.viewBoards">
            <router-link :to="{ name: 'oms.bodies.boards', params: { id: body.id } }" :class="['button', 'is-fullwidth']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'users']" /></span>
              <span class="field-label">Boards</span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.viewJoinRequests">
            <router-link :to="{ name: 'oms.bodies.join_requests', params: { id: body.id } }" :class="['button', 'is-fullwidth']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'users']" /></span>
              <span class="field-label">Join requests</span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.viewCampaigns">
            <router-link :to="{ name: 'oms.bodies.campaigns', params: { id: body.id } }" :class="['button', 'is-fullwidth']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'users']" /></span>
              <span class="field-label">Recruitment campaigns</span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="!isMember">
            <a @click="askToJoinBody()" v-if="!isRequestingMembership" :class="['button', 'is-fullwidth', 'is-info']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'user-plus']" /></span>
              <span class="field-label">Ask to join body</span>
            </a>

            <a v-if="isRequestingMembership" :class="['button', 'is-fullwidth', 'is-static']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'clock']" /></span>
              <span class="field-label">Join request sent</span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.viewMembers && can.addMembers">
            <a @click="openAddMemberModal()" :class="['button', 'is-fullwidth']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'user-plus']" /></span>
              <span class="field-label">Add member</span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.createBoundCircles">
            <a @click="openAddCircleModal()" :class="['button', 'is-fullwidth', 'is-warning']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'edit']" /></span>
              <span class="field-label">Add bound circle</span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.updateBody">
            <router-link :to="{ name: 'oms.bodies.edit', params: { id: body.id } }" :class="['button', 'is-fullwidth', 'is-warning']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'edit']" /></span>
              <span class="field-label">Edit body details</span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.manageBoards">
            <a @click="openChangeBoardModal()" :class="['button', 'is-fullwidth', 'is-primary']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'users']" /></span>
              <span class="field-label">Change board</span>
            </a>
          </div>

          <div class="field is-grouped" v-if="isMember">
            <a @click="askLeaveBody()" :class="['button', 'is-fullwidth', 'is-danger']">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'sign-out-alt']" /></span>
              <span class="field-label">Leave body</span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.deleteBody">
            <a @click="askChangeStatus('deleted')" :class="['button', 'is-fullwidth', 'is-danger']" v-if="body.status === 'active'">
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'times']" /></span>
              <span class="field-label">Delete body</span>
            </a>

            <a @click="askChangeStatus('active')" :class="['button', 'is-fullwidth', 'is-info']" v-else>
              <span class="field-icon icon"><font-awesome-icon :icon="['fas', 'history']" /></span>
              <span class="field-label">Restore body</span>
            </a>
          </div>
        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ body.name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Title</th>
                  <td>{{ body.name }}</td>
                </tr>
                <tr v-if="!['antenna', 'contact antenna', 'contact'].includes(body.type) && body.abbreviation">
                  <th>Abbreviation</th>
                  <td>{{ body.abbreviation }}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>
                    <span v-html="$options.filters.markdown(body.description)" />
                  </td>
                </tr>
                <tr v-if="body.task_description">
                  <th>Task description</th>
                  <td>
                    <span v-html="$options.filters.markdown(body.task_description)" />
                  </td>
                <tr>
                  <th>Type</th>
                  <td>{{ body.type | capitalize }}</td>
                </tr>
                <tr>
                  <th>Code</th>
                  <td>{{ body.code }}</td>
                </tr>
                <tr v-if="body.founded_at">
                  <th>Foundation date</th>
                  <td>{{ body.founded_at }}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td v-if="body.email"><a :href="'mailto:' + body.email">{{ body.email }}</a></td>
                  <td v-if="!body.email"><i>Not set.</i></td>
                </tr>
                <tr v-if="body.phone">
                  <th>Phone</th>
                  <td>{{ body.phone }}</td>
                </tr>
                <tr v-if="body.address">
                  <th>Address</th>
                  <td>{{ body.address }}</td>
                </tr>
                <tr v-if="body.postal_address">
                  <th>Postal address</th>
                  <td>{{ body.postal_address }}</td>
                </tr>
                <tr v-if="body.website">
                  <th>Website</th>
                  <td><a :href="body.website" target="_blank" rel="noopener noreferrer">{{ body.website }}</a></td>
                </tr>
                <tr v-if="can.viewShadowCircles">
                  <th>Shadow circle</th>
                  <td v-if="body.shadow_circle"><router-link :to="{ name: 'oms.circles.view', params: { id: body.shadow_circle.id } }">{{ body.shadow_circle.name }}</router-link></td>
                  <td v-if="!body.shadow_circle"><i>No shadow circle assigned.</i></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="boards.length">
        <div class="content">
          <p class="subtitle">Board</p>
          <div class="content" v-for="board in boards" v-bind:key="board.id">
            <table class="table is-narrow">
              <tbody>
                <tr v-if="board.name">
                  <th>Name</th>
                  <td>{{ board.name }}</td>
                </tr>
                <tr>
                  <th>Term</th>
                  <td>{{ board.start_date }} - {{ board.end_date }}</td>
                </tr>
                <tr>
                  <th>President</th>
                  <td>{{ board.president_user.first_name }} {{ board.president_user.last_name }}</td>
                </tr>
                <tr>
                  <th>Secretary</th>
                  <td>{{ board.secretary_user.first_name }} {{ board.secretary_user.last_name }}</td>
                </tr>
                <tr>
                  <th>Treasurer</th>
                  <td>{{ board.treasurer_user.first_name }} {{ board.treasurer_user.last_name }}</td>
                </tr>
                <tr v-for="position in board.other_members" v-bind:key="position.index">
                  <th>{{ position.function }}</th>
                  <td>{{ position.user.first_name }} {{ position.user.last_name }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="body.circles.length">
        <div class="content">
          <p class="subtitle">Bound circles</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
                <tr v-for="circle in body.circles" v-bind:key="circle.id">
                  <td><router-link :to="{ name: 'oms.circles.view', params: { id: circle.id } }">{{ circle.name }}</router-link></td>
                  <td>{{ circle.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>

    <b-loading :is-full-page="false" :active.sync="isLoading" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import AddBoundCircleModal from './AddBoundCircleModal'
import AddMemberModal from './AddMemberModal'
import ChangeBoardModal from './ChangeBoardModal'

export default {
  name: 'SingleBody',
  data () {
    return {
      body: {
        name: '',
        abbreviation: '',
        description: '',
        task_description: '',
        type: '',
        id: null,
        code: null,
        circles: [],
        date_of_birth: null,
        email: null,
        phone: null,
        address: null,
        postal_address: null,
        shadow_circle: null,
        shadow_circle_id: null
      },
      boards: [],
      isLoading: false,
      isMember: false,
      isRequestingMembership: false,
      permissions: [],
      can: {
        viewMembers: false,
        viewMembersGlobal: false,
        viewBoards: false,
        viewJoinRequests: false,
        viewCampaigns: false,
        createBoundCircles: false,
        manageBoards: false,
        updateBody: false,
        deleteBody: false,
        addMembers: false
      }
    }
  },
  methods: {
    openAddCircleModal () {
      this.$buefy.modal.open({
        component: AddBoundCircleModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          body: this.body,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    openAddMemberModal () {
      this.$buefy.modal.open({
        component: AddMemberModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          body: this.body,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    openChangeBoardModal () {
      this.$buefy.modal.open({
        component: ChangeBoardModal,
        hasModalCard: true,
        props: {
          body: this.body,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    askChangeStatus (newStatus) {
      const isDeleting = newStatus === 'deleted'

      const title = isDeleting ? 'Deleting a body' : 'Restoring a body'
      const confirmText = isDeleting ? 'Delete body' : 'Restore body'
      const type = isDeleting ? 'is-danger' : 'is-info'

      let message = `Are you sure you want to <b>${isDeleting ? 'delete' : 'restore'}</b> this body?`
      if (isDeleting) {
        message += 'This action cannot be undone.'
      }

      this.$buefy.dialog.confirm({
        title,
        message,
        confirmText,
        type,
        hasIcon: true,
        onConfirm: () => this.changeStatus(newStatus)
      })
    },
    changeStatus (newStatus) {
      const isDeleting = newStatus === 'deleted'
      this.isLoading = true

      this.axios.put(this.services['core'] + '/bodies/' + this.$route.params.id + '/status', { status: newStatus }).then(() => {
        this.isLoading = false
        this.$root.showSuccess(isDeleting ? 'Body is deleted.' : 'Body is restored')
        this.body.status = newStatus
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not change body status', err)
      })
    },
    askToJoinBody () {
      if (!this.loginUser) {
        return this.$router.push({ name: 'oms.login', query: { to: '/bodies/' + this.$route.params.id } })
      }

      this.$buefy.dialog.prompt({
        message: 'Join body',
        inputAttrs: {
          placeholder: 'Motivation',
          required: false
        },
        onConfirm: (motivation) => this.joinBody(motivation)
      })
    },
    joinBody (motivation) {
      this.isLoading = true
      this.axios.post(this.services['core'] + '/bodies/' + this.$route.params.id + '/join-requests', {
        motivation
      }).then(() => {
        this.$root.showSuccess('Join request is sent.')
        this.isLoading = false
        this.isRequestingMembership = true
      }).catch((err) => {
        this.isLoading = false
        if (err.response.status === 422) {
          this.$root.showError('You\'ve already requested to join this body.')
        } else {
          this.$root.showError('Could not sent join request', err)
        }
      })
    },
    askLeaveBody () {
      this.$buefy.dialog.confirm({
        title: 'Leaving a body',
        message: 'Are you sure you want to <b>leave</b> this body? You will probably not be able to join later.',
        confirmText: 'Leave body',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.leaveBody()
      })
    },
    leaveBody () {
      this.axios.delete(this.services['core'] + '/bodies/' + this.$route.params.id + '/members').then(() => {
        this.isMember = false
        this.isRequestingMembership = false
        this.$root.showSuccess('You are not the member anymore.')
      }).catch((err) => {
        this.$root.showError('Could not delete body', err)
      })
    }
  },
  mounted () {
    this.isLoading = true
    // Get body for this page
    this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id).then((response) => {
      this.body = response.data.data

      // Get current board(s) for this body
      this.axios.get(this.services['network'] + '/bodies/' + this.body.id + '/boards/current').then((boardResponse) => {
        this.boards = boardResponse.data.data

        return this.axios.get(this.services['core'] + '/bodies/' + this.body.id + '/members')
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
        // TODO: remove 403 once all members can view boards
        if (err.response.status === 403 || err.response.status === 404) {
          return
        }
        this.$root.showError('Some error happened', err)
      })

      if (this.loginUser) {
        this.isMember = this.loginUser.bodies.some(body => body.id === this.body.id)
        this.isRequestingMembership = this.loginUser.join_requests.some(request => request.body_id === this.body.id)

        return this.axios.get(this.services['core'] + '/bodies/' + this.$route.params.id + '/my_permissions').then((permissionsResponse) => {
          this.permissions = permissionsResponse.data.data
          this.can.viewMembers = this.permissions.some(permission => permission.combined.endsWith('view:member'))
          this.can.viewMembersGlobal = this.permissions.some(permission => permission.combined.endsWith('global:view:member'))
          this.can.viewBoards = this.permissions.some(permission => permission.combined.endsWith('view:board')) && ['contact', 'contact antenna', 'antenna'].includes(this.body.type)
          this.can.viewJoinRequests = this.permissions.some(permission => permission.combined.endsWith('view:join_request'))
          this.can.viewCampaigns = this.permissions.some(permission => permission.combined.endsWith('view:campaign'))
          this.can.viewShadowCircles = this.permissions.some(permission => permission.combined.endsWith('view:shadow_circle'))
          this.can.createBoundCircles = this.permissions.some(permission => permission.combined.endsWith('create:bound_circle'))
          this.can.manageBoards = this.permissions.some(permission => permission.combined.endsWith('manage_network:boards'))
          this.can.updateBody = this.permissions.some(permission => permission.combined.endsWith('update:body'))
          this.can.deleteBody = this.permissions.some(permission => permission.combined.endsWith('delete:body'))
          this.can.addMembers = this.permissions.some(permission => permission.combined.endsWith('add_member:body'))

          this.isLoading = false
        })
      }
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Body is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.bodies.list' })
    })
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>

<style lang="scss">
/*
  .field {
    width: 80%;
    margin: 0 auto 0.75rem auto;

    .button {
      padding: 1.5rem 1rem;
    }

    .field-label {
      width: 85%;
      text-align: left;
      margin-right: 0;
    }

    .field-icon {
      width: 15%;
    }
  }
*/
</style>
