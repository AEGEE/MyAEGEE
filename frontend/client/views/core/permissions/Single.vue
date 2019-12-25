<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ permission.combined }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Code</th>
                  <td>{{ permission.combined }}</td>
                </tr>
                <tr>
                  <th>Description</th>
                  <td>{{ permission.description }}</td>
                </tr>
                <tr>
                  <th>Always assigned?</th>
                  <td>{{ permission.always_assigned ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Filters</th>
                  <td v-if="permission.filters.length === 0"><i>Not set</i></td>
                  <td v-if="permission.filters.length > 0">
                    <ul>
                      <li v-for="filter in permission.filters" v-bind:key="filter.field">{{ filter.field }}</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th>Directly attached to:</th>
                  <td v-if="permission.circles.length === 0"><i>Not attached</i></td>
                  <td v-if="permission.circles.length > 0">
                    <ul>
                      <li v-for="circle in permission.circles" v-bind:key="circle.id">
                        <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id } }">{{ circle.name }}</router-link>
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
        <router-link class="button is-warning" :to="{ name: 'oms.permissions.edit', params: { id: permission.id } }" v-if="can.edit">
          Edit permission
        </router-link>

        <a class="button is-danger" @click="askDeletePermission()" v-if="can.delete">
          Delete permission
        </a>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'SinglePermission',
  data () {
    return {
      permission: {
        combined: null,
        description: null,
        always_assigned: null,
        filters: [],
        circles: []
      },
      isOwnProfile: false,
      isLoading: false,
      permissions: [],
      can: {
        edit: false,
        delete: false
      }
    }
  },
  methods: {
    askDeletePermission () {
      this.$buefy.dialog.confirm({
        title: 'Deleting permission',
        message: 'Are you sure you want to <b>delete</b> this permission? This action cannot be undone.',
        confirmText: 'Delete permission',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deletePermission()
      })
    },
    deletePermission () {
      this.axios.delete(this.services['oms-core-elixir'] + '/permissions/' + this.permission.id).then((response) => {
        this.$root.showSuccess('Permission is deleted.')
        this.$router.push({ name: 'oms.permissions.list' })
      }).catch((err) => this.$root.showError('Could not delete permission', err))
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/permissions/' + this.$route.params.id).then((response) => {
      this.permission = response.data.data

      return this.axios.get(this.services['oms-core-elixir'] + '/my_permissions')
    }).then((response) => {
      this.permissions = response.data.data

      this.can.edit = this.permissions.some(permission => permission.combined.endsWith('update:permission'))
      this.can.delete = this.permissions.some(permission => permission.combined.endsWith('delete:permission'))
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Permission is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.permissions.list' })
    })
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>
