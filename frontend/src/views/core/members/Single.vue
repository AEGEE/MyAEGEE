<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!user.image" src="/images/logo.png">
            <img v-if="user.image" :src="services['core-static'] + '/headimages/' + user.image">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info" v-if="can.edit">
          <div class="field is-grouped">
            <a class="button is-fullwidth is-primary" data-cy="picture-change-link" @click="openPictureModal()">
              <span>Change picture</span>
              <span class="icon"><font-awesome-icon icon="camera" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <router-link :to="{ name: 'oms.members.edit', params: { id: user.username || user.id } }" class="button is-fullwidth is-warning">
              <span>Edit profile</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="isOwnProfile">
            <router-link :to="{ name: 'oms.members.edituser', params: { id: user.username || user.id } }" class="button is-fullwidth is-warning">
              <span>Change password</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <button class="button is-fullwidth is-warning" @click="askChangeEmail()">
              <span>Change email</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.edit && this.user.gsuite_id != null && this.user.gsuite_id != ''">
            <button class="button is-fullwidth is-warning" @click="editPrimaryEmail()">
              <span>Set primary email</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <button class="button is-fullwidth is-warning" @click="editPrimaryBodyModal()">
              <span>Set primary body</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.setActive">
            <a v-if="user.active" class="button is-fullwidth is-danger" :class="{ 'is-loading': isSwitchingStatus }" @click="askToggleActive()" data-cy="suspend-user-link">
              <span>Suspend user</span>
              <span class="icon"><font-awesome-icon icon="minus" /></span>
            </a>

            <a v-if="!user.active" class="button is-fullwidth is-primary" :class="{ 'is-loading': isSwitchingStatus }" @click="askToggleActive()" data-cy="activate-user-link">
              <span>Activate user</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.setSuperadmin">
            <a v-if="!user.superadmin" class="button is-fullwidth is-danger" :class="{ 'is-loading': isSwitchingSuperadmin }" @click="askToggleSuperadmin()">
              <span>Add superadmin status</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </a>

            <a v-if="user.superadmin" class="button is-fullwidth is-danger" :class="{ 'is-loading': isSwitchingSuperadmin }" @click="askToggleSuperadmin()">
              <span>Remove superadmin status</span>
              <span class="icon"><font-awesome-icon icon="minus" /></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.delete">
            <a class="button is-fullwidth is-danger" @click="askDeleteUser()">
              <span>Delete profile</span>
              <span class="icon"><font-awesome-icon icon="times" /></span>
            </a>
          </div>

        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title" data-cy="first_name">{{ user.first_name }}</p>
          <p class="subtitle" data-cy="last_name">{{ user.last_name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Profile link</th>
                  <td><router-link :to="{ name: 'oms.members.view', params: { id: user.username || user.id } }"><span data-cy="username">https://my.aegee.eu/members/{{ user.username || user.id }}</span></router-link></td>
                </tr>
                <tr>
                  <th>Primary body</th>
                  <td v-if="user.primary_body"><router-link :to="{ name: 'oms.bodies.view', params: { id: user.primary_body.id } }">{{ user.primary_body.name }}</router-link></td>
                  <td v-if="!user.primary_body"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td data-cy="phone">{{ user.phone }}</td>
                </tr>
                <tr>
                  <th>Date of birth</th>
                  <td data-cy="date_of_birth">{{ user.date_of_birth }}</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td data-cy="gender">{{ user.gender }}</td>
                </tr>
                <tr>
                  <th>Address</th>
                  <td data-cy="address">{{ user.address }}</td>
                </tr>
                <tr>
                  <th>About me</th>
                  <td data-cy="about_me">{{ user.about_me }}</td>
                </tr>
                <tr>
                  <th>Is superadmin?</th>
                  <td data-cy="superadmin">{{ (user.superadmin) ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Notification email</th>
                  <td><a :href="'mailto:' + user.email" data-cy="notification_email">{{ user.notification_email }}</a></td>
                </tr>
                <tr>
                  <th>Google Workspace account</th>
                  <td v-if="user.gsuite_id"><a :href="'mailto:' + user.gsuite_id" data-cy="gsuite">{{ user.gsuite_id }}</a></td>
                  <td v-if="!user.gsuite_id"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Login suspended?</th>
                  <td data-cy="active">{{ user.active ? 'No' : 'Yes' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.bodies.length">
        <div class="content">
          <p class="subtitle">Bodies</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
                <tr v-for="body in user.bodies" v-bind:key="body.id">
                  <td><router-link :to="{ name: 'oms.bodies.view', params: { id: body.id } }">{{ body.code }}</router-link></td>
                  <td>{{ body.name }}</td>
                  <td>{{ body.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.circles.length">
        <div class="content">
          <p class="subtitle">Circles</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
                <tr v-for="circle in user.circles" v-bind:key="circle.id">
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
import EditPrimaryBodyModal from './EditPrimaryBodyModal.vue'
import EditPrimaryEmailModal from './EditPrimaryEmailModal.vue'
import PictureModal from './PictureModal.vue'

export default {
  name: 'SingleUser',
  data () {
    return {
      user: {
        name: '',
        surname: '',
        id: null,
        primary_body: null,
        bodies: [],
        circles: [],
        date_of_birth: null,
        gender: null,
        phone: null,
        notification_email: null,
        active: null,
        superadmin: null,
        username: null,
        image: null
      },
      isOwnProfile: false,
      isLoading: false,
      isSwitchingStatus: false,
      permissions: [],
      can: {
        edit: false,
        setActive: false,
        setSuperadmin: false,
        delete: false
      }
    }
  },
  methods: {
    openPictureModal () {
      this.$buefy.modal.open({
        component: PictureModal,
        hasModalCard: true,
        props: {
          user: this.user,
          permissions: this.permissions,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    askDeleteUser () {
      this.$buefy.dialog.confirm({
        title: 'Deleting a user',
        message: 'Are you sure you want to <b>delete</b> this user? This action cannot be undone.',
        confirmText: 'Delete user',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteUser()
      })
    },
    deleteUser () {
      this.axios.delete(this.services['core'] + '/members/' + this.user.id).then(() => {
        this.$root.showSuccess('User is deleted.')
        this.$router.push({ name: 'oms.members.list' })
      }).catch((err) => this.$root.showError('Could not delete user', err))
    },
    editPrimaryBodyModal () {
      this.$buefy.modal.open({
        component: EditPrimaryBodyModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          member: this.user,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    askToggleActive () {
      const active = this.user.active
      this.$buefy.dialog.confirm({
        title: active ? 'Suspend user' : 'Activate user',
        message: 'Are you sure you want to <b>' + (active ? 'suspend' : 'activate') + '</b> this user?',
        confirmText: active ? 'Suspend user' : 'Activate user',
        type: active ? 'is-danger' : 'is-primary',
        icon: active ? 'exclamation-circle' : 'plus-circle',
        hasIcon: true,
        onConfirm: () => this.toggleActive()
      })
    },
    toggleActive () {
      this.isSwitchingStatus = true
      this.axios.put(this.services['core'] + '/members/' + this.user.id + '/active', { active: !this.user.active }).then((response) => {
        this.user.active = response.data.data.active
        this.$root.showSuccess('User is ' + (this.user.active ? 'activated.' : 'suspended.'))
        this.isSwitchingStatus = false
      }).catch((err) => {
        this.$root.showError('Error changing user status', err)
        this.isSwitchingStatus = false
      })
    },
    askToggleSuperadmin () {
      const superadmin = this.user.superadmin
      this.$buefy.dialog.confirm({
        title: superadmin ? 'Remove superadmin status' : 'Add superadmin status',
        message: 'Are you sure you want to <b>' + (superadmin ? 'remove superadmin status' : 'add superadmin status') + '</b> for this user?',
        confirmText: superadmin ? 'Remove superadmin status' : 'Add superadmin status',
        type: 'is-danger',
        icon: 'exclamation-circle',
        hasIcon: true,
        onConfirm: () => this.toggleSuperadmin()
      })
    },
    toggleSuperadmin () {
      this.isSwitchingSuperadmin = true
      this.axios.put(this.services['core'] + '/members/' + this.user.id + '/superadmin', { superadmin: !this.user.superadmin }).then((response) => {
        this.user.superadmin = response.data.data.superadmin
        this.$root.showSuccess('User has ' + (this.user.superadmin ? '' : 'no ') + 'superadmin powers')
        this.isSwitchingSuperadmin = false
      }).catch((err) => {
        this.$root.showError('Error changing superadmin powers', err)
        this.isSwitchingSuperadmin = false
      })
    },
    askChangeEmail () {
      this.$buefy.dialog.prompt({
        message: 'Change email',
        inputAttrs: {
          type: 'email',
          placeholder: 'Change email'
        },
        trapFocus: true,
        onConfirm: (newEmail) => this.changeEmail(newEmail)
      })
    },
    changeEmail (newEmail) {
      this.axios.put(this.services['core'] + '/members/' + this.user.id + '/email', { new_email: newEmail }).then(() => {
        this.$root.showSuccess('An email change is triggered. Check your new inbox for a confirmation.')
      }).catch((err) => {
        this.$root.showError('Error changing user email', err)
      })
    },
    editPrimaryEmail () {
      this.$buefy.modal.open({
        component: EditPrimaryEmailModal,
        hasModalCard: true,
        props: {
          member: this.user,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    fetchUser () {
      this.isLoading = true
      this.axios.get(this.services['core'] + '/members/' + this.$route.params.id).then((response) => {
        this.user = response.data.data
        this.isOwnProfile = this.user.id === this.loginUser.id

        // Combining global permissions and local ones for bodies of this users.
        const links = [
          this.services['core'] + '/members/' + this.$route.params.id + '/my_permissions',
          ...this.user.bodies.map(body => this.services['core'] + '/bodies/' + body.id + '/my_permissions')
        ]

        return Promise.all(links.map(link => this.axios.get(link)))
      }).then((responses) => {
        this.permissions = responses[0].data.data // global permissions

        // for global and local permissions for users' bodies check the following:
        // set the permission to true if at least one set of permissions have
        // the required permission (either first for global, or others for local).
        this.can.setActive = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('update_active:member')))
        this.can.setSuperadmin = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('update_superadmin:member')))
        this.can.edit = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('update:member'))) || this.isOwnProfile
        this.can.delete = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('delete:member')))

        this.isLoading = false
      }).catch((err) => {
        if (err.response && err.response.status === 404) {
          this.$root.showError('User is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }

        this.$router.push({ name: 'oms.members.list' })
      })
    }
  },
  watch: {
    '$route.params.id': function () {
      this.fetchUser()
    }
  },
  mounted () {
    this.fetchUser()
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>
