<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ circle.name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{{ circle.name }}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>{{ circle.description }}</td>
                </tr>
                <tr>
                  <th>Body</th>
                  <td v-if="circle.body"><router-link :to="{ name: 'oms.bodies.view', params:{ id: circle.body.id } }">{{ circle.body.name }} </router-link></td>
                  <td v-if="!circle.body"><i>This circle is not associated to a body</i></td>
                </tr>
                <tr>
                  <th>Joinable?</th>
                  <td>{{ circle.joinable ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Parent circle</th>
                  <td v-if="circle.parent_circle"><router-link :to="{ name: 'oms.circles.view', params:{ id: circle.parent_circle.id } }">{{ circle.parent_circle.name }} </router-link></td>
                  <td v-if="!circle.parent_circle"><i>This circle is a toplevel circle</i></td>
                </tr>
                <tr>
                  <th>Child circles</th>
                  <td v-if="circle.child_circles.length === 0"><i>This circle does not have child circles.</i></td>
                  <td v-if="circle.child_circles.length > 0">
                    <ul>
                      <li v-for="childCircle in circle.child_circles" v-bind:key="childCircle.id">
                        <router-link :to="{ name: 'oms.circles.view', params: { id: childCircle.id } }">
                          {{ childCircle.name }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th>Attached permissions</th>
                  <td v-if="circle.permissions.length === 0"><i> No permissions directly attached.</i></td>
                  <td v-if="circle.permissions.length > 0" class="circle-permissions-list">
                    <ul>
                      <li v-for="permission in circle.permissions" v-bind:key="permission.id">
                        <router-link :to="{ name: 'oms.permissions.view', params: { id: permission.id } }">
                          {{ permission.combined }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th>Inherited permissions</th>
                  <td v-if="inheritedPermissions.length === 0"><i> No permissions inherited.</i></td>
                  <td v-if="inheritedPermissions.length > 0" class="circle-permissions-list">
                    <ul>
                      <li v-for="permission in inheritedPermissions" v-bind:key="permission.id">
                        <router-link :to="{ name: 'oms.permissions.view', params: { id: permission.id } }">
                          {{ permission.combined }}
                        </router-link>
                      </li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child">
        <router-link class="button" :to="{ name: 'oms.circles.members', params: { id: circle.id } }" v-if="can.viewMembers">
          View members
        </router-link>

        <router-link class="button is-warning" :to="{ name: 'oms.circles.edit', params: { id: circle.id } }" v-if="can.edit">
          Edit circle
        </router-link>

        <a class="button is-info" @click="addMemberModal()" v-if="can.addMembers">
          Add member
        </a>

        <a class="button is-info" @click="joinCircle()" v-if="can.join && !isMember">
          Join circle
        </a>

        <a class="button is-danger" @click="askLeaveCircle()" v-if="isMember">
          Leave circle
        </a>

        <a class="button is-danger" @click="askDeleteCircle()" v-if="can.delete">
          Delete circle
        </a>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import AddMemberModal from './AddMemberModal'

export default {
  name: 'SingleCircle',
  data () {
    return {
      circle: {
        id: null,
        name: '',
        description: '',
        joinable: false,
        parent_circle: null,
        child_circles: [],
        permissions: [],
        body: null,
        body_id: null
      },
      inheritedPermissions: [],
      isOwnProfile: false,
      isLoading: false,
      permissions: [],
      isMember: false,
      isLoadingMembers: false,
      cancelToken: null,
      members: [],
      can: {
        edit: false,
        delete: false,
        join: false,
        viewMembers: false,
        addMembers: false
      }
    }
  },
  methods: {
    addMemberModal () {
      this.$modal.open({
        component: AddMemberModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          circle: this.circle,
          services: this.services,
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    askDeleteCircle () {
      this.$dialog.confirm({
        title: 'Deleting circle',
        message: 'Are you sure you want to <b>delete</b> this circle? This action cannot be undone.',
        confirmText: 'Delete circle',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteCircle()
      })
    },
    deleteCircle () {
      this.axios.delete(this.services['oms-core-elixir'] + '/circles/' + this.circle.id).then((response) => {
        this.$root.showInfo('Circle is deleted.')
        this.$router.push({ name: 'oms.circles.list' })
      }).catch((err) => this.$root.showDanger('Could not delete circle: ' + err.message))
    },
    joinCircle () {
      this.isLoading = true
      this.axios.post(this.services['oms-core-elixir'] + '/circles/' + this.circle.id + '/members').then((response) => {
        this.$root.showSuccess('Successfully joined circle.')
        this.can.join = false
        this.isMember = true
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        let message = 'Could not join circle: ' +
          ((err.response.data.errors && 'circle_membership_unique' in err.response.data.errors)
            ? 'You are already a member of this circle.'
            : err.message)

        this.$root.showDanger(message)
      })
    },
    askLeaveCircle () {
      this.$dialog.confirm({
        title: 'Leave circle',
        message: 'Are you sure you want to <b>leave</b> this circle? You will probably not be able to join it later.',
        confirmText: 'Leave circle',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.leaveCircle()
      })
    },
    leaveCircle () {
      this.isLoading = true
      this.axios.delete(this.services['oms-core-elixir'] + '/circles/' + this.circle.id + '/members').then((response) => {
        this.$root.showSuccess('Successfully left circle.')
        this.can.join = true
        this.isMember = false
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not leave circle: ' + err.message)
      })
    },
    loadData (id) {
      this.isLoading = true
      this.axios.get(this.services['oms-core-elixir'] + '/circles/' + id).then((response) => {
        this.circle = response.data.data

        this.isMember = this.loginUser.circle_memberships.some(membership => membership.circle.id === this.circle.id)

        return this.axios.get(this.services['oms-core-elixir'] + '/circles/' + id + '/my_permissions')
      }).then((response) => {
        this.permissions = response.data.data

        this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:circle'))
        this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:circle'))
        this.can.join = this.permissions.some(permission => permission.combined.endsWith('join:circle')) && this.circle.joinable
        this.can.viewMembers = this.permissions.some(permission => permission.combined.endsWith('view_members:circle'))

        // A person has the right to add members in 2 cases: this person has add_member:circle permission and
        // 1) the circle is bound to a body
        // 2) the circle is unbound and the person has view:member permission (to search globall for users)
        const hasPermissionToAdd = this.permissions.some(permission => permission.combined.endsWith('add_member:circle'))
        const hasPermissionToViewMembers = this.permissions.some(permission => permission.combined.endsWith('view:member'))
        this.can.addMembers = hasPermissionToAdd && (this.circle.body_id || hasPermissionToViewMembers)

        return this.axios.get(this.services['oms-core-elixir'] + '/circles/' + id + '/permissions')
      }).then((response) => {
        this.inheritedPermissions = response.data.data

        this.isLoading = false
      }).catch((err) => {
        let message = (err.response.status === 404) ? 'Circle is not found' : 'Some error happened: ' + err.message

        this.$root.showDanger(message)
        this.$router.push({ name: 'oms.circles.list' })
      })
    }
  },
  mounted () {
    this.loadData(this.$route.params.id)
  },
  watch: {
    '$route.params.id' (newId, oldId) {
      this.loadData(newId)
    }
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>

<style>
.circle-permissions-list {
  word-break: break-all;
}
</style>