<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Network Director listing</div>

        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name, surname or email" />
            </div>
          </div>
        </div>

        <div>Total participants: {{ applications.length }}</div>

        <b-table
          :data="filteredApplications"
          :loading="isLoading"
          paginated
          :per-page="limit"
          default-sort="id"
          default-sort-direction="desc">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="user_id" label="User ID" sortable>
              {{ props.row.user_id }}
            </b-table-column>

            <b-table-column field="first_name" label="First name" centered sortable>
              {{ props.row.first_name | beautify }}
            </b-table-column>

            <b-table-column field="last_name" label="Last name" centered sortable>
              {{ props.row.last_name | beautify }}
            </b-table-column>

            <b-table-column field="body_name" label="Body" centered sortable>
              {{ props.row.body_name }}
            </b-table-column>

            <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered sortable>
              <span :class="calculateClassForMemberslist(props.row)">
                {{ props.row.is_on_memberslist | beautify }}
              </span>
            </b-table-column>

            <b-table-column label="Set memberslist status" centered sortable>
              <div class="select" :class="{ 'is-loading': props.row.isSavingOnMemberslist }">
                <select v-model="props.row.newIsOnMemberslist" @change="switchPaxRegistered(props.row)">
                  <option :value="true">Is on memberslist</option>
                  <option :value="false">Is not on memberslist</option>
                </select>
              </div>
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
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'JuridicalView',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      query: '',
      limit: 50,
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    filteredApplications () {
      const lowercaseQuery = this.query.toLowerCase()

      return this.applications.filter(app =>
        ['first_name', 'last_name'].some(field => app[field].toLowerCase().includes(lowercaseQuery)))
    }
  },
  methods: {
    calculateClassForMemberslist (pax) {
      return ['tag', 'is-small', pax.is_on_memberslist ? 'is-primary' : 'is-danger']
    },
    switchPaxRegistered (pax) {
      pax.isSavingOnMemberslist = true
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/is_on_memberslist'

      this.axios.put(url, { is_on_memberslist: pax.newIsOnMemberslist }).then(() => {
        pax.is_on_memberslist = pax.newIsOnMemberslist
        pax.isSavingOnMemberslist = false
        this.$root.showSuccess(`Successfully updated memberslist status of application for application #${pax.id}`)
      }).catch((err) => {
        pax.isSavingOnMemberslist = false
        this.$root.showDanger('Could not update participant memberslist info: ' + err.message)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data

      return this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/network')
    }).then((application) => {
      this.applications = application.data.data
      this.isLoading = false

      // Fetching users and bodies.
      for (const pax of this.applications) {
        this.$set(pax, 'newIsOnMemberslist', pax.is_on_memberslist)
        this.$set(pax, 'isSavingOnMemberslist', false)
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
