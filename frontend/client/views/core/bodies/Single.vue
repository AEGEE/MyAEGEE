<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img src="https://bulma.io/images/placeholders/480x480.png">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped" v-if="can.seeMembers">
            <router-link :to="{ name: 'oms.bodies.members', params: { id: body.id } }" class="button is-fullwidth">
              <span>View members</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="can.seeJoinRequests">
            <router-link :to="{ name: 'oms.bodies.join_requests', params: { id: body.id } }" class="button is-fullwidth">
              <span>View join requests</span>
              <span class="icon"><i class="fa fa-users"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="!isMember && !isRequestingMembership">
            <a @click="askToJoinBody()" class="button is-fullwidth is-info">
              <span>Request to join</span>
              <span class="icon"><i class="fa fa-user-plus"></i></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.createCircle">
            <a @click="isAddingCircle = true" class="button is-fullwidth is-warning">
              <span>Add bound circle</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.edit">
            <router-link :to="{ name: 'oms.bodies.edit', params: { id: body.id } }" class="button is-fullwidth is-warning">
              <span>Edit body details</span>
              <span class="icon"><i class="fa fa-edit"></i></span>
            </router-link>
          </div>

          <div class="field is-grouped" v-if="isMember">
            <a @click="askLeaveBody()" class="button is-fullwidth is-danger">
              <span>Leave body</span>
              <span class="icon"><i class="fa fa-sign-out"></i></span>
            </a>
          </div>

          <div class="field is-grouped" v-if="can.delete">
            <a class="button is-fullwidth is-danger" @click="askDeleteBody()">
              <span>Delete body</span>
              <span class="icon"><i class="fa fa-times"></i></span>
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
                  <td>{{ body.name}}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>
                    <span v-html="$options.filters.markdown(body.description)"></span>
                  </td>
                </tr>
                <tr>
                  <th>Code</th>
                  <td>{{ body.legacy_key }}</td>
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

    <div class="modal is-active" v-show="isAddingCircle">
      <div class="modal-background"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Add circle</p>
          <button class="delete" aria-label="close" @click="isAddingCircle = false"></button>
        </header>
        <section class="modal-card-body">
          <div class="field">
            <label class="label">Name</label>
            <div class="control">
              <input class="input" type="text" required v-model="tmpCircle.name" />
            </div>
            <p class="help is-danger" v-if="circleErrors.name">{{ circleErrors.name.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Description</label>
            <div class="control">
              <input class="input" type="text" required v-model="tmpCircle.description" />
            </div>
            <p class="help is-danger" v-if="circleErrors.description">{{ circleErrors.description.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Joinable?
              <input class="checkbox" type="checkbox" v-model="tmpCircle.joinable" />
            </label>
            <p class="help is-danger" v-if="circleErrors.description">{{ circleErrors.description.join(', ')}}</p>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-success" @click="saveBoundCircle()">Save changes</button>
          <button class="button" @click="isAddingCircle = false">Cancel</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SingleBody',
  data () {
    return {
      body: {
        name: '',
        description: '',
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
      isAddingCircle: false,
      permissions: [],
      tmpCircle: {
        name: '',
        description: '',
        joinable: false
      },
      circleErrors: {},
      can: {
        edit: false,
        delete: false,
        createCircle: false
      }
    }
  },
  methods: {
    askDeleteBody () {
      this.$dialog.confirm({
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
      this.$dialog.prompt({
        message: 'Join body',
        inputAttrs: {
          placeholder: 'Motivation',
          required: true
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
      this.$dialog.confirm({
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
    },
    saveBoundCircle () {
      this.isLoading = true
      this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/circles', {
        circle: this.tmpCircle
      }).then((response) => {
        this.$root.showSuccess('Bound circle is created.')

        this.tmpCircle = { name: '', description: '', joinable: false }
        this.body.circles.push(response.data.data)

        this.isLoading = false
        this.isAddingCircle = false
      }).catch((err) => {
        this.isLoading = false
        let message = err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response.errors) this.circleErrors = err.response.errors

        this.$root.showDanger(message)
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

      this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:body'))
      this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:body'))
      this.can.seeMembers = this.permissions.some(permission => permission.combined.endsWith('view:member'))
      this.can.seeJoinRequests = this.permissions.some(permission => permission.combined.endsWith('view:join_request'))
      this.can.createCircle = this.permissions.some(permission => permission.combined.endsWith('create:bound_circle'))

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
