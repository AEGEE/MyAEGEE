<template>
  <div class="tile is-ancestor" :aria-busy="isLoading ? 'true' : 'false'">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!user.image" src="/images/logo.png" alt="" />
            <img v-if="user.image" :src="services['core-static'] + '/headimages/' + user.image" :alt="'Profile picture of ' + user.first_name + ' ' + user.last_name" />
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info" v-if="can.edit || can.setActive || can.setEventApplicationBan || can.setSuperadmin || can.delete">
          <div class="field is-grouped" v-if="can.edit">
            <button type="button" class="button is-fullwidth is-primary" @click="openPictureModal()">
              <span>Change picture</span>
              <span class="icon"><font-awesome-icon icon="camera" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <router-link
              :to="{ name: 'oms.members.edit', params: { id: user.username || user.id } }"
              class="button is-fullwidth is-warning"
            >
              <span>Edit profile</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="isOwnProfile">
            <router-link
              :to="{ name: 'oms.members.edituser', params: { id: user.username || user.id } }"
              class="button is-fullwidth is-warning"
            >
              <span>Change password</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <button type="button" class="button is-fullwidth is-warning" @click="askChangeEmail()">
              <span>Change email</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </button>
          </div>

          <div
            class="field is-grouped"
            v-if="can.edit && this.user.gsuite_id != null && this.user.gsuite_id != ''"
          >
            <button type="button" class="button is-fullwidth is-warning" @click="editPrimaryEmail()">
              <span>Set primary email</span>
              <span class="icon"><font-awesome-icon icon="envelope" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <button type="button" class="button is-fullwidth is-warning" @click="editPrimaryBodyModal()">
              <span>Set primary body</span>
              <span class="icon"><font-awesome-icon icon="edit" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.setActive && !isOwnProfile">
            <button
              v-if="user.active"
              type="button"
              class="button is-fullwidth is-danger"
              :class="{ 'is-loading': isSwitchingStatus }"
              :disabled="isSwitchingStatus"
              @click="askToggleActive()"
            >
              <span>Suspend user</span>
              <span class="icon"><font-awesome-icon icon="minus" /></span>
            </button>

            <button
              v-if="!user.active"
              type="button"
              class="button is-fullwidth is-primary"
              :class="{ 'is-loading': isSwitchingStatus }"
              :disabled="isSwitchingStatus"
              @click="askToggleActive()"
            >
              <span>Activate user</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.setEventApplicationBan && !activeEventApplicationBan">
            <button
              type="button"
              class="button is-fullwidth is-danger"
              :class="{ 'is-loading': isSwitchingEventApplicationBan }"
              :disabled="isSwitchingEventApplicationBan"
              @click="askSetEventApplicationBan()"
            >
              <span>Ban event applications</span>
              <span class="icon"><font-awesome-icon icon="minus" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.setEventApplicationBan && activeEventApplicationBan">
            <button
              type="button"
              class="button is-fullwidth is-primary"
              :class="{ 'is-loading': isSwitchingEventApplicationBan }"
              :disabled="isSwitchingEventApplicationBan"
              @click="askLiftEventApplicationBan()"
            >
              <span>Lift event application ban</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.setSuperadmin">
            <button
              v-if="!user.superadmin"
              type="button"
              class="button is-fullwidth is-danger"
              :class="{ 'is-loading': isSwitchingSuperadmin }"
              :disabled="isSwitchingSuperadmin"
              @click="askToggleSuperadmin()"
            >
              <span>Add superadmin status</span>
              <span class="icon"><font-awesome-icon icon="plus" /></span>
            </button>

            <button
              v-if="user.superadmin"
              type="button"
              class="button is-fullwidth is-danger"
              :class="{ 'is-loading': isSwitchingSuperadmin }"
              :disabled="isSwitchingSuperadmin"
              @click="askToggleSuperadmin()"
            >
              <span>Remove superadmin status</span>
              <span class="icon"><font-awesome-icon icon="minus" /></span>
            </button>
          </div>

          <div class="field is-grouped" v-if="can.delete">
            <button type="button" class="button is-fullwidth is-danger" @click="askDeleteUser()">
              <span>Delete profile</span>
              <span class="icon"><font-awesome-icon icon="times" /></span>
            </button>
          </div>
        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="notification is-info" v-if="emailChangeNotice">
          <button class="delete" aria-label="Close" @click="emailChangeNotice = ''" />
          {{ emailChangeNotice }}
        </div>
        <div class="content">
          <p class="title" role="heading" aria-level="1">{{ user.first_name }}</p>
          <p class="subtitle">{{ user.last_name }}</p>
          <div class="content">
            <table class="table is-narrow facts">
              <tbody>
                <tr>
                  <th scope="row">Profile link</th>
                  <td>
                    <router-link
                      :to="{ name: 'oms.members.view', params: { id: user.username || user.id } }"
                    ><span
                    >https://my.aegee.eu/members/{{ user.username || user.id }}</span
                    ></router-link
                    >
                  </td>
                </tr>
                <tr>
                  <th scope="row">Primary body</th>
                  <td v-if="user.primary_body">
                    <router-link
                      :to="{ name: 'oms.bodies.view', params: { id: user.primary_body.id } }"
                    >{{ user.primary_body.name }}</router-link
                    >
                  </td>
                  <td v-if="!user.primary_body"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th scope="row">Phone</th>
                  <td>{{ user.phone }}</td>
                </tr>
                <tr>
                  <th scope="row">Date of birth</th>
                  <td>{{ user.date_of_birth }}</td>
                </tr>
                <tr>
                  <th scope="row">Gender</th>
                  <td>{{ user.gender }}</td>
                </tr>
                <tr>
                  <th scope="row">Address</th>
                  <td>{{ user.address }}</td>
                </tr>
                <tr>
                  <th scope="row">About me</th>
                  <td>{{ user.about_me }}</td>
                </tr>
                <tr>
                  <th scope="row">Is superadmin?</th>
                  <td>{{ user.superadmin ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th scope="row">Notification email</th>
                  <td>
                    <a :href="'mailto:' + user.notification_email">{{ user.notification_email }}</a>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Google Workspace account</th>
                  <td v-if="user.gsuite_id">
                    <a :href="'mailto:' + user.gsuite_id">{{ user.gsuite_id }}</a>
                  </td>
                  <td v-if="!user.gsuite_id"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th scope="row">Login suspended?</th>
                  <td>{{ user.active ? 'No' : 'Yes' }}</td>
                </tr>
                <tr v-if="can.viewEventApplicationBan">
                  <th scope="row">Event application ban</th>
                  <td v-if="activeEventApplicationBan">
                    Until {{ user.event_application_ban.ban_until | datetime }}
                  </td>
                  <td v-if="!activeEventApplicationBan">No active ban</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.bodies.length">
        <div class="content">
          <p class="subtitle" role="heading" aria-level="2">Bodies</p>
          <div class="content">
            <table class="table is-narrow">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="body in sortedBodies" v-bind:key="body.id">
                  <td>
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id } }">{{
                      body.code
                    }}</router-link>
                  </td>
                  <td>
                    {{ body.name }}
                    <span v-if="body.id === user.primary_body_id" class="tag is-info is-light">Primary</span>
                  </td>
                  <td>{{ body.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.circles.length">
        <div class="content">
          <p class="subtitle" role="heading" aria-level="2">Circles</p>
          <div class="content">
            <table class="table is-narrow">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="circle in user.circles" v-bind:key="circle.id">
                  <td>
                    <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id } }">{{
                      circle.name
                    }}</router-link>
                  </td>
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
import escapeHtml from 'src/methods/escape-html'
import { mapGetters } from 'vuex'
import moment from 'moment'
import EditPrimaryBodyModal from './EditPrimaryBodyModal.vue'
import EditPrimaryEmailModal from './EditPrimaryEmailModal.vue'
import PictureModal from './PictureModal.vue'
import sortBodies from '../../../methods/sort-bodies'

export default {
  name: 'SingleUser',
  data () {
    return {
      user: {
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
        event_application_ban: null,
        username: null,
        image: null
      },
      isOwnProfile: false,
      emailChangeNotice: '',
      isLoading: false,
      isSwitchingStatus: false,
      isSwitchingEventApplicationBan: false,
      isSwitchingSuperadmin: false,
      permissions: [],
      can: {
        edit: false,
        setActive: false,
        setEventApplicationBan: false,
        viewEventApplicationBan: false,
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
        ariaLabel: 'Change picture',
        props: {
          user: this.user,
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
      this.axios
        .delete(this.services['core'] + '/members/' + this.user.id)
        .then(() => {
          this.$root.showSuccess('User is deleted.')
          this.$router.push({ name: 'oms.members.list' })
        })
        .catch((err) => this.$root.showError('Could not delete user', err))
    },
    editPrimaryBodyModal () {
      this.$buefy.modal.open({
        component: EditPrimaryBodyModal,
        hasModalCard: true,
        ariaLabel: 'Edit primary body',
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
        message:
          'Are you sure you want to <b>' + (active ? 'suspend' : 'activate') + '</b> this user?',
        confirmText: active ? 'Suspend user' : 'Activate user',
        type: active ? 'is-danger' : 'is-primary',
        icon: active ? 'exclamation-circle' : 'plus-circle',
        hasIcon: true,
        onConfirm: () => this.toggleActive()
      })
    },
    toggleActive () {
      this.isSwitchingStatus = true
      this.axios
        .put(this.services['core'] + '/members/' + this.user.id + '/active', {
          active: !this.user.active
        })
        .then((response) => {
          this.user.active = response.data.data.active
          this.$root.showSuccess('User is ' + (this.user.active ? 'activated.' : 'suspended.'))
          this.isSwitchingStatus = false
        })
        .catch((err) => {
          this.$root.showError('Error changing user status', err)
          this.isSwitchingStatus = false
        })
    },
    askSetEventApplicationBan () {
      this.$buefy.dialog.prompt({
        title: 'Ban event applications',
        message: 'Set the end date of the temporary ban. The maximum is 3 months from today.',
        inputAttrs: {
          'aria-label': 'Ban until',
          type: 'date',
          min: moment().add(1, 'day').format('YYYY-MM-DD'),
          max: moment().add(3, 'months').format('YYYY-MM-DD'),
          required: true
        },
        trapFocus: true,
        onConfirm: (banUntil) => this.confirmEventApplicationBan(banUntil)
      })
    },
    confirmEventApplicationBan (banUntil) {
      this.isSwitchingEventApplicationBan = true
      this.fetchFutureApplications().then((applications) => {
        const futureApplications = applications.length > 0
          ? '<p>This user already has future applications. These applications will remain active:</p><ul>'
            + applications.map((application) => '<li>' + this.escapeHtml(application.event_name) + ' (' + this.escapeHtml(application.service) + ', ' + this.escapeHtml(application.application_status) + ')</li>').join('')
            + '</ul>'
          : '<p>This user has no active future applications.</p>'

        this.$buefy.dialog.confirm({
          title: 'Confirm event application ban',
          message: futureApplications + '<p>Do you want to apply the ban until <b>' + moment(banUntil).format('YYYY-MM-DD') + '</b>?</p>',
          confirmText: 'Apply ban',
          type: 'is-danger',
          hasIcon: true,
          onConfirm: () => this.setEventApplicationBan(banUntil),
          onCancel: () => {
            this.isSwitchingEventApplicationBan = false
          }
        })
      }).catch((err) => {
        this.isSwitchingEventApplicationBan = false
        this.$root.showError('Could not fetch future applications', err)
      })
    },
    fetchFutureApplications () {
      const links = [
        this.services['events'] + '/applications/future/' + this.user.id,
        this.services['statutory'] + '/applications/future/' + this.user.id,
        this.services['summeruniversity'] + '/applications/future/' + this.user.id
      ]

      return Promise.all(links.map(link => this.axios.get(link).then(response => response.data.data))).then((responses) => responses.reduce((acc, list) => acc.concat(list), []))
    },
    escapeHtml,
    setEventApplicationBan (banUntil) {
      this.axios
        .put(this.services['core'] + '/members/' + this.user.id + '/event-application-ban', {
          ban_until: banUntil
        })
        .then((response) => {
          this.user.event_application_ban = response.data.data
          this.$root.showSuccess('Event application ban is active.')
          this.isSwitchingEventApplicationBan = false
        })
        .catch((err) => {
          this.$root.showError('Error setting event application ban', err)
          this.isSwitchingEventApplicationBan = false
        })
    },
    askLiftEventApplicationBan () {
      this.$buefy.dialog.confirm({
        title: 'Lift event application ban',
        message: 'Are you sure you want to lift this user\'s event application ban?',
        confirmText: 'Lift ban',
        type: 'is-primary',
        hasIcon: true,
        onConfirm: () => this.liftEventApplicationBan()
      })
    },
    liftEventApplicationBan () {
      this.isSwitchingEventApplicationBan = true
      this.axios
        .delete(this.services['core'] + '/members/' + this.user.id + '/event-application-ban')
        .then(() => {
          this.user.event_application_ban = null
          this.$root.showSuccess('Event application ban is lifted.')
          this.isSwitchingEventApplicationBan = false
        })
        .catch((err) => {
          this.$root.showError('Error lifting event application ban', err)
          this.isSwitchingEventApplicationBan = false
        })
    },
    askToggleSuperadmin () {
      const superadmin = this.user.superadmin
      this.$buefy.dialog.confirm({
        title: superadmin ? 'Remove superadmin status' : 'Add superadmin status',
        message:
          'Are you sure you want to <b>'
          + (superadmin ? 'remove superadmin status' : 'add superadmin status')
          + '</b> for this user?',
        confirmText: superadmin ? 'Remove superadmin status' : 'Add superadmin status',
        type: 'is-danger',
        icon: 'exclamation-circle',
        hasIcon: true,
        onConfirm: () => this.toggleSuperadmin()
      })
    },
    toggleSuperadmin () {
      this.isSwitchingSuperadmin = true
      this.axios
        .put(this.services['core'] + '/members/' + this.user.id + '/superadmin', {
          superadmin: !this.user.superadmin
        })
        .then((response) => {
          this.user.superadmin = response.data.data.superadmin
          this.$root.showSuccess(
            'User has ' + (this.user.superadmin ? '' : 'no ') + 'superadmin powers'
          )
          this.isSwitchingSuperadmin = false
        })
        .catch((err) => {
          this.$root.showError('Error changing superadmin powers', err)
          this.isSwitchingSuperadmin = false
        })
    },
    askChangeEmail () {
      this.$buefy.dialog.prompt({
        message: 'Change email',
        inputAttrs: {
          'aria-label': 'New email',
          type: 'email',
          placeholder: 'Change email'
        },
        trapFocus: true,
        onConfirm: (newEmail) => this.changeEmail(newEmail)
      })
    },
    changeEmail (newEmail) {
      this.emailChangeNotice = ''

      this.axios
        .put(this.services['core'] + '/members/' + this.user.id + '/email', { new_email: newEmail })
        .then((response) => {
          const message = response.data.message || 'An email change is triggered. Check your new inbox for a confirmation.'

          // If the member's current address has to confirm too, the server says what happens next
          // and what to do if that address can't be reached. That stays on the page until it's closed.
          if (response.data.data && response.data.data.needs_old_address_confirmation) {
            this.emailChangeNotice = message
            return
          }

          // The server tells which address has to confirm the change, so showing its message a bit longer.
          this.$root.showNotification({ message, duration: 10000 })
        })
        .catch((err) => {
          this.$root.showError('Error changing user email', err)
        })
    },
    editPrimaryEmail () {
      this.$buefy.modal.open({
        component: EditPrimaryEmailModal,
        hasModalCard: true,
        ariaLabel: 'Set primary email',
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
      this.axios
        .get(this.services['core'] + '/members/' + this.$route.params.id)
        .then((response) => {
          this.user = response.data.data
          this.isOwnProfile = this.user.id === this.loginUser.id

          // Combining global permissions and local ones for bodies of this users.
          const links = [
            this.services['core'] + '/members/' + this.$route.params.id + '/my_permissions',
            ...this.user.bodies.map(
              (body) => this.services['core'] + '/bodies/' + body.id + '/my_permissions'
            )
          ]

          return Promise.all(links.map((link) => this.axios.get(link)))
        })
        .then((responses) => {
          this.permissions = responses[0].data.data // global permissions

          // for global and local permissions for users' bodies check the following:
          // set the permission to true if at least one set of permissions have
          // the required permission (either first for global, or others for local).
          this.can.setActive = responses.some((list) => list.data.data.some((permission) => permission.combined === 'global:update_active:user'))
          this.can.setEventApplicationBan = responses.some((list) => list.data.data.some((permission) => permission.combined === 'global:update_application_ban:member'))
          this.can.viewEventApplicationBan = this.isOwnProfile || this.can.setEventApplicationBan
          this.can.setSuperadmin = responses.some((list) => list.data.data.some((permission) => permission.combined.endsWith('update_superadmin:member')))
          this.can.edit = responses.some((list) => list.data.data.some((permission) => permission.combined.endsWith('update:member'))) || this.isOwnProfile
          this.can.delete = responses.some((list) => list.data.data.some((permission) => permission.combined.endsWith('delete:member')))

          this.isLoading = false
        })
        .catch((err) => {
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
      // The notice is about the member that was shown before.
      this.emailChangeNotice = ''
      this.fetchUser()
    }
  },
  mounted () {
    this.fetchUser()
  },
  computed: {
    ...mapGetters({
      loginUser: 'user',
      services: 'services'
    }),
    activeEventApplicationBan () {
      return this.user.event_application_ban && new Date(this.user.event_application_ban.ban_until) > new Date()
    },
    sortedBodies () {
      return sortBodies(this.user.bodies, this.user.primary_body_id)
    }
  }
}
</script>

<style scoped>
/* Long values (the profile link, addresses) wrap instead of making the page wider than a phone. */
.facts td {
  overflow-wrap: anywhere;
}
</style>
