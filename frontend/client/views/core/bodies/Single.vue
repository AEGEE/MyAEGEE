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
          <div v-for="(item, index) in actions" v-bind:key="index" class="field is-grouped" v-if="checkPermissions(item.permission)">
            <a v-if="item.type !== 'link'" @click="item.action(item.name)" :class="['button', 'is-fullwidth', item.class]">
              <span class="field-icon icon"><i :class="['fas fa-' + item.icon]"></i></span>
              <span class="field-label">{{ item.label }}</span>
            </a>
            <router-link v-if="item.type === 'link'" :to="{ name: item.name, params: item.params() || {} }" :class="['button', 'is-fullwidth', item.class]">
              <span class="field-icon icon"><i :class="['fas fa-' + item.icon]"></i></span>
              <span class="field-label">{{ item.label }}</span>
            </router-link>
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
                  <td>{{ body.name}}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>
                    <span v-html="$options.filters.markdown(body.description)"></span>
                  </td>
                </tr>
                <tr>
                  <th>Type</th>
                  <td>{{ body.type | capitalize }}</td>
                </tr>
                <tr>
                  <th>Code</th>
                  <td>{{ body.legacy_key }}</td>
                </tr>
                <tr>
                  <th>Foundation date</th>
                  <td>{{ body.founded_at }}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td v-if="body.email"><a :href="'mailto:' + body.email">{{ body.email }}</td>
                  <td v-if="!body.email"><i>Not set.</i></td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td v-if="body.phone">{{ body.phone }}</td>
                  <td v-if="!body.phone"><i>No phone specified.</i></td>
                </tr>
                <tr>
                  <th>Address</th>
                  <td>{{ body.address }}</td>
                </tr>
                <tr>
                  <th>Shadow circle</th>
                  <td v-if="body.shadow_circle"><router-link :to="{ name: 'oms.circles.view', params: { id: body.shadow_circle.id} }">{{ body.shadow_circle.name }}</router-link></td>
                  <td v-if="!body.shadow_circle"><i>No shadow circle assigned.</i></td>
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

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import AddBoundCircleModal from './AddBoundCircleModal'

export default {
  name: 'SingleBody',
  data () {
    return {
      body: {
        name: '',
        description: '',
        type: '',
        id: null,
        legacy_key: null,
        circles: [],
        date_of_birth: null,
        email: null,
        phone: null,
        address: null,
        shadow_circle: null,
        shadow_circle_id: null
      },
      isLoading: false,
      isMember: false,
      isRequestingMembership: false,
      permissions: [],
      actions: [
        {
          name: 'oms.bodies.members',
          params: () => ({ id: this.body.id }),
          label: 'Members',
          type: 'link',
          class: '',
          icon: 'users',
          permission: 'view:member'
        },
        {
          name: 'oms.bodies.join_requests',
          params: () => ({ id: this.body.id }),
          label: 'Join requests',
          type: 'link',
          class: '',
          icon: 'users',
          permission: 'view:join_request'
        },
        {
          name: 'oms.bodies.campaigns',
          params: () => ({ id: this.body.id }),
          label: 'Recruitment campaigns',
          type: 'link',
          class: '',
          icon: 'users',
          permission: 'view:campaign'
        },
        {
          name: 'requestToJoin',
          label: 'Request to join',
          action: this.askToJoinBody,
          class: 'is-info',
          icon: 'user-plus',
          permission: 'join'
        },
        {
          name: 'joinRequestPending',
          label: 'Join request sent.',
          action: () => {},
          class: 'is-static',
          icon: 'clock',
          permission: 'joinRequestSent'
        },
        {
          name: 'createBoundCircle',
          label: 'Add bound circle',
          action: this.openAddCircleModal,
          class: 'is-warning',
          icon: 'edit',
          permission: 'create:bound_circle'
        },
        {
          name: 'oms.bodies.edit',
          params: () => ({ id: this.body.id }),
          label: 'Edit body details',
          type: 'link',
          class: 'is-warning',
          icon: 'edit',
          permission: 'update:body'
        },
        {
          name: 'leaveBody',
          label: 'Leave body',
          action: this.askLeaveBody,
          class: 'is-danger',
          icon: 'sign-out-alt',
          permission: 'leave'
        },
        {
          name: 'deleteBody',
          label: 'Delete body',
          action: this.askDeleteBody,
          class: 'is-danger',
          icon: 'times',
          permission: 'delete:body'
        }
      ]
    }
  },
  methods: {
    checkPermissions (name) {
      if (name === 'join') {
        return !this.isMember && !this.isRequestingMembership
      }

      if (name === 'joinRequestSent') {
        return !this.isMember && this.isRequestingMembership
      }

      if (name === 'leave') {
        return this.isMember
      }

      return this.permissions.some(permission => permission.combined.endsWith(name))
    },
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
          showDanger: this.$root.showDanger,
          showSuccess: this.$root.showSuccess
        }
      })
    },
    askDeleteBody () {
      this.$buefy.dialog.confirm({
        title: 'Deleting a body',
        message: 'Are you sure you want to <b>delete</b> this body? This action cannot be undone.',
        confirmText: 'Delete body',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteBody()
      })
    },
    deleteBody () {
      this.axios.delete(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id).then((response) => {
        this.$root.showSuccess('Body is deleted.')
        this.$router.push({ name: 'oms.bodies.list' })
      }).catch((err) => this.$root.showDanger('Could not delete body: ' + err.message))
    },
    askToJoinBody () {
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
      this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/members', {
        join_request: { motivation }
      }).then((response) => {
        this.$root.showSuccess('Join request is sent.')
        this.isLoading = false
        this.isRequestingMembership = true
      }).catch((err) => {
        this.isLoading = false
        let message = err.response.status === 422 ? 'You\'ve already requested to join this body.' : err.message

        this.$root.showDanger(message)
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
      this.axios.delete(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/members').then((response) => {
        this.isMember = false
        this.isRequestingMembership = false
        this.$root.showSuccess('You are not the member anymore.')
      }).catch((err) => {
        this.$root.showDanger('Could not delete body: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id).then((response) => {
      this.body = response.data.data
      this.isMember = this.loginUser.bodies.some(body => body.id === this.body.id)
      this.isRequestingMembership = this.loginUser.join_requests.some(request => request.body_id === this.body.id)

      return this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data
      this.isLoading = false
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Body is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
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
