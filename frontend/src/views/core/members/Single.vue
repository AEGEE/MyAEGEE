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
        <article class="tile is-child is-info" v-if="can.edit">
          <div class="field is-grouped">
            <a class="button is-fullwidth is-primary" @click="updatePicture()">
              <span>Change picture</span>
              <span class="icon"><i class="fa fa-camera"></i></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <router-link :to="{ name: 'oms.members.edit', params: { id: user.seo_url || user.id } }" class="button is-fullwidth is-warning">
              <span>Edit profile</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="isOwnProfile">
            <router-link :to="{ name: 'oms.members.edituser', params: { id: user.seo_url || user.id } }" class="button is-fullwidth is-warning">
              <span>Change email or password</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.setActive">
            <a v-if="user.user.active" class="button is-fullwidth is-danger" :class="{'is-loading': isSwitchingStatus }" @click="askToggleActive()">
              <span>Suspend user</span>
              <span class="icon"><i class="fa fa-minus"></i></span>
            </a>

            <a v-if="!user.user.active" class="button is-fullwidth is-success" :class="{'is-loading': isSwitchingStatus }" @click="askToggleActive()">
              <span>Activate user</span>
              <span class="icon"><i class="fa fa-plus"></i></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.delete">
            <a class="button is-fullwidth is-danger" @click="askDeleteUser()">
              <span>Delete profile</span>
              <span class="icon"><i class="fa fa-times"></i></span>
            </a>
          </div>

        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ user.first_name }}</p>
          <p class="subtitle">{{ user.last_name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Profile link</th>
                  <td>/members/{{ user.seo_url || user.id }}</td>
                </tr>
                <tr>
                  <th>Primary body</th>
                  <td v-if="user.primary_body"><router-link :to="{ name: 'oms.bodies.view', params: { id: user.primary_body.id } }">{{ user.primary_body.name }}</router-link></td>
                  <td v-if="!user.primary_body"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td>{{ user.phone }}</td>
                </tr>
                <tr>
                  <th>Date of birth</th>
                  <td>{{ user.date_of_birth }}</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td>{{ user.gender }}</td>
                </tr>
                <tr>
                  <th>Address</th>
                  <td>{{ user.address }}</td>
                </tr>
                <tr>
                  <th>About me</th>
                  <td>{{ user.about_me }}</td>
                </tr>
                <tr>
                  <th>Is superadmin?</th>
                  <td>{{ (user.user && user.user.superadmin) ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Email</th><td v-if="user.user.email"><a :href="'mailto:' + user.user.email">{{ user.user.email }}</a></td>
                  <td v-if="!user.user.email"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Username</th>
                  <td>{{ user.user.name }}</td>
                </tr>
                <tr>
                  <th>Login suspended?</th>
                  <td>{{ user.user.active ? 'No' : 'Yes' }}</td>
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
                  <td><router-link :to="{ name: 'oms.bodies.view', params: { id: body.id } }">{{ body.legacy_key }}</router-link></td>
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

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SingleUser',
  data () {
    return {
      user: {
        name: '',
        surname: '',
        id: null,
        seo_url: null,
        primary_body: null,
        bodies: [],
        circles: [],
        date_of_birth: null,
        gender: null,
        phone: null,
        user: {
          email: null,
          active: null,
          superadmin: null,
          name: null
        }
      },
      isOwnProfile: false,
      isLoading: false,
      isSwitchingStatus: false,
      permissions: [],
      can: {
        edit: false,
        setActive: false,
        delete: false
      }
    }
  },
  methods: {
    updatePicture () {
      this.$root.showInfo('This feature is not implemented yet, come join the OMS to help us implementing it ;)')
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
      this.axios.delete(this.services['oms-core-elixir'] + '/user/' + this.user.user.id).then(() => {
        this.$root.showSuccess('User is deleted.')
        this.$router.push({ name: 'oms.members.list' })
      }).catch((err) => this.$root.showError('Could not delete user', err))
    },
    askToggleActive () {
      const active = this.user.user.active
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
      this.axios.put(this.services['oms-core-elixir'] + '/user/' + this.user.user.id, { active: !this.user.user.active }).then((response) => {
        this.user.user.active = response.data.data.active
        this.isSwitchingStatus = false
      }).catch((err) => {
        this.$root.showError('Error changing user status', err)
        this.isSwitchingStatus = false
      })
    },
    fetchUser () {
      this.isLoading = true
      this.axios.get(this.services['oms-core-elixir'] + '/members/' + this.$route.params.id).then((response) => {
        this.user = response.data.data
        this.isOwnProfile = this.user.id === this.loginUser.id

        // Combining global permissions and local ones for bodies of this users.
        const links = [
          this.services['oms-core-elixir'] + '/members/' + this.$route.params.id + '/my_permissions',
          ...this.user.bodies.map(body => this.services['oms-core-elixir'] + '/bodies/' + body.id + '/my_permissions')
        ]

        return Promise.all(links.map(link => this.axios.get(link)))
      }).then((responses) => {
        this.permissions = responses[0].data.data // global permissions

        // for global and local permissions for users' bodies check the following:
        // set the permission to true if at least one set of permissions have
        // the required permission (either first for global, or others for local).
        this.can.setActive = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('update_active:user')))
        this.can.edit = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('update:member')))
        this.can.delete = responses.some(list => list.data.data.some(permission => permission.combined.endsWith('delete:user')))

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
