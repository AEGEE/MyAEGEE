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

        <b-table :data="members">
          <template slot-scope="props">
            <b-table-column field="member.first_name" label="First name">
              {{ props.row.member.first_name }}
            </b-table-column>

            <b-table-column field="member.last_name" label="Last name">
              {{ props.row.member.last_name }}
            </b-table-column>

            <b-table-column field="user.email" label="Email">
              {{ props.row.user.email }}
            </b-table-column>

            <b-table-column field="user.name" label="Username">
              {{ props.row.user.name }}
            </b-table-column>

            <b-table-column label="Delete user">
              <a v-if="!props.row.status" @click="members.splice(props.index, 1)" class="button is-danger is-small">
                <span class="icon"><i class="fa fa-minus"></i></span>
                <span>Delete user</span>
              </a>
            </b-table-column>

            <b-table-column label="Status">
              <span v-if="props.row.status === 'saving'">Saving...</span>
              <span class="has-text-success" v-if="props.row.status === 'success'">Successfully saved.</span>
              <span class="has-text-danger" v-if="props.row.status === 'error'">Error while saving: {{ props.row.errors }}</span>
            </b-table-column>
          </template>

          <template slot="empty">
            <section class="section">
              <div class="content has-text-grey has-text-centered">
                <p>
                  <b-icon icon="fa fa-times-circle" size="is-large"></b-icon>
                </p>
                <p>Nothing here.</p>
              </div>
            </section>
          </template>
        </b-table>

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
      const csvArray = input
        .replace(/;/g, ',') // replacing all semicolons with commas
        .replace(/"/g, '') // removing all quotes
        .split('\n') // splitting by new lime
        .filter(line => line.length > 0) // removing empty strings
        .map(elt => elt.split(','))

      // Checking if each line has at least 3 columns.
      if (csvArray.some(elt => elt.length < 3)) {
        return this.$root.showDanger('CSV is malformed.')
      }

      this.members = csvArray.map((element) => {
        const firstName = element[0].trim()
        const lastName = element[1].trim()
        const email = element[2].trim()

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
