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
          <b-table-column field="first_name" label="First name" v-slot="props">
            {{ props.row.first_name }}
          </b-table-column>

          <b-table-column field="last_name" label="Last name" v-slot="props">
            {{ props.row.last_name }}
          </b-table-column>

          <b-table-column field="email" label="Email" v-slot="props">
            {{ props.row.email }}
          </b-table-column>

          <b-table-column field="username" label="Username" v-slot="props">
            {{ props.row.username }}
          </b-table-column>

          <b-table-column label="Delete user" v-slot="props">
            <a v-if="!props.row.status" @click="members.splice(props.index, 1)" class="button is-danger is-small">
              <span class="icon"><font-awesome-icon icon="minus" /></span>
              <span>Delete user</span>
            </a>
          </b-table-column>

          <b-table-column label="Status" v-slot="props">
            <span v-if="props.row.status === 'saving'">Saving...</span>
            <span class="has-text-success" v-if="props.row.status === 'success'">Successfully saved.</span>
            <span class="has-text-danger" v-if="props.row.status === 'error'">Error while saving: {{ props.row.errors }}</span>
          </b-table-column>

          <template slot="empty">
            <section class="section">
              <empty-table-stub />
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

      return this.axios.post(this.services['core'] + '/bodies/' + this.$route.params.id + '/create-member', member).then(() => {
        this.$set(member, 'status', 'success')

        this.$root.showSuccess('User is created.')
      }).catch((err) => {
        this.$set(member, 'status', 'error')

        if (err.response.status === 422) { // validation errors
          this.$set(member, 'errors', err.response.data.errors)
          return this.$root.showError('Some of the user data is invalid.')
        }

        this.$root.showError('Could not create user', err)
      })
    },
    openFileDialog (event) {
      const file = event.target.files[0]
      if (!file) {
        return
      }

      if (file) {
        const reader = new FileReader()
        reader.readAsText(file, 'UTF-8')
        reader.onload = (evt) => this.processFileContent(evt.target.result)
        reader.onerror = (err) => {
          this.$root.showError('Could not open file', err)
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
        return this.$root.showError('CSV is malformed.')
      }

      this.members = csvArray.map((element) => {
        const firstName = element[0].trim()
        const lastName = element[1].trim()
        const email = element[2].trim()

        const username = firstName.toLowerCase() + '.' + lastName.toLowerCase().replace(/ /g, '')
        return {
          first_name: firstName,
          last_name: lastName,
          username,
          email
        }
      })
    }
  },
  mounted () {

  }
}
</script>
