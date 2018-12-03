<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Bulk import members</h4>

        <div class="notification is-info">
          Select the CSV file for users to import with the following format: <i>first_name,last_name,email</i>. The username is generated automatically based on first and last name.
        </div>

        <div class="field is-grouped">
          <div class="control">
            <input type="file" @change="openFileDialog($event)">
          </div>
        </div>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Email</th>
                <th>User name</th>
                <th></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>First name</th>
                <th>Last name</th>
                <th>Email</th>
                <th>User name</th>
                <th></th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-show="members.length" v-for="(member, index) in members" v-bind:key="member.id">
                <td>{{ member.member.first_name }}</td>
                <td>{{ member.member.last_name }}</td>
                <td>{{ member.user.email }}</td>
                <td>{{ member.user.name }}</td>
                <td>
                  <a v-if="!member.status" @click="members.splice(index, 1)" class="button is-danger is-small">
                    <span class="icon"><i class="fa fa-minus"></i></span>
                    <span>Delete user</span>
                  </a>
                  <span v-if="member.status === 'saving'">Saving...</span>
                  <span class="has-text-success" v-if="member.status === 'success'">Successfully saved.</span>
                  <span class="has-text-danger" v-if="member.status === 'error'">Error while saving: {{ member.errors }}</span>
                </td>
              </tr>
              <tr v-show="!members.length">
                <td colspan="5" class="has-text-centered">The members list is empty or not uploaded yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="field" v-show="members.length">
          <div class="control">
            <a type="submit" @click="createMembers()" class="button is-primary is-fullwidth">Create members</a>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BulkImportMembers',
  data () {
    return {
      members: [],
      source: null,
      permissions: [],
      can: {
        create: false
      }
    }
  },
  computed: mapGetters(['services']),
  methods: {
    async createMembers () {
      for (const member of this.members) {
        if (member.status !== 'success') {
          await this.createUser(member)
        }
      }
    },
    createUser (member) {
      this.$set(member, 'status', 'saving')
      this.$set(member, 'errors', {})

      return this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.$route.params.id + '/new_member', {
        member: member.member,
        user: member.user
      }).then((response) => {
        this.$set(member, 'status', 'success')

        this.$root.showSuccess('User is created.')
      }).catch((err) => {
        this.$set(member, 'status', 'error')

        if (err.response.status === 422) { // validation errors
          this.$set(member, 'errors', err.response.data.errors)
          return this.$root.showDanger('Some of the user data is invalid.')
        }

        this.$root.showDanger('Could not create user: ' + err.message)
      })
    },
    openFileDialog (event) {
      const file = event.target.files[0]
      if (!file) {
        return
      }

      if (file) {
        var reader = new FileReader()
        reader.readAsText(file, 'UTF-8')
        reader.onload = (evt) => this.processFileContent(evt.target.result)
        reader.onerror = (err) => {
          this.$root.showDanger('Could not open file: ' + err.message)
        }
      }
    },
    processFileContent (input) {
      // CSV content: first_name,last_name,email
      this.members = input.split('\n').filter(line => line.length > 0).map((line) => {
        const split = line.split(',')
        const firstName = split[0].trim()
        const lastName = split[1].trim()
        const email = split[2].trim()

        const username = firstName.toLowerCase() + '.' + lastName.toLowerCase().replace(/ /g, '.')
        return {
          member: {
            first_name: firstName,
            last_name: lastName
          },
          user: {
            name: username,
            email
          }
        }
      })
    }
  },
  mounted () {

  }
}
</script>
