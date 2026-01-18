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

        <div>Total participants: {{ total }}</div>

        <b-table
          :data="applications"
          :loading="isLoading"
          paginated
          backend-pagination
          :total="total"
          :per-page="limit"
          @page-change="onPageChange"
          backend-sorting
          default-sort="statutory_id"
          default-sort-direction="desc"
          @sort="onSort">
          <b-table-column field="statutory_id" label="#" numeric sortable v-slot="props">
            {{ props.row.statutory_id }}
          </b-table-column>

          <b-table-column field="user_id" label="User ID" sortable v-slot="props">
            {{ props.row.user_id }}
          </b-table-column>

          <b-table-column field="first_name" label="First name" centered sortable v-slot="props">
            {{ props.row.first_name | beautify }}
          </b-table-column>

          <b-table-column field="last_name" label="Last name" centered sortable v-slot="props">
            {{ props.row.last_name | beautify }}
          </b-table-column>

          <b-table-column field="body_name" label="Body" centered sortable v-slot="props">
            {{ props.row.body_name }}
          </b-table-column>

          <b-table-column field="participant_type" label="Participant type" centered sortable v-slot="props">
            {{ props.row.participant_type | capitalize }}
          </b-table-column>

          <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered sortable v-slot="props">
            <span :class="calculateClassForMemberslist(props.row)">
              {{ props.row.is_on_memberslist | beautify }}
            </span>
          </b-table-column>

          <b-table-column label="Set memberslist status" centered sortable v-slot="props">
            <div class="select" :class="{ 'is-loading': props.row.isSavingOnMemberslist }">
              <select v-model="props.row.newIsOnMemberslist" @change="switchPaxRegistered(props.row)">
                <option :value="true">Is on memberslist</option>
                <option :value="false">Is not on memberslist</option>
              </select>
            </div>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'NetworkDirectorView',
  data () {
    return {
      applications: [],
      event: {
        questions: []
      },
      sort: {
        field: 'id',
        direction: 'desc'
      },
      query: '',
      limit: 50,
      offset: 0,
      total: 0,
      isLoading: false,
      isSaving: false
    }
  },
  watch: {
    query () {
      this.loadApplications()
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset,
        sort: this.sort
      }

      if (this.query) queryObj.query = this.query
      return queryObj
    }
  },
  methods: {
    calculateClassForMemberslist (pax) {
      return ['tag', 'is-small', pax.is_on_memberslist ? 'is-primary' : 'is-danger']
    },
    switchPaxRegistered (pax) {
      pax.isSavingOnMemberslist = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/is_on_memberslist'

      this.axios.put(url, { is_on_memberslist: pax.newIsOnMemberslist }).then(() => {
        pax.is_on_memberslist = pax.newIsOnMemberslist
        pax.isSavingOnMemberslist = false
        this.$root.showSuccess(`Successfully updated memberslist status of application for application #${pax.id}`)
      }).catch((err) => {
        pax.isSavingOnMemberslist = false
        this.$root.showError('Could not update participant memberslist info', err)
      })
    },
    onPageChange (page) {
      this.offset = (page - 1) * this.limit
      this.loadApplications()
    },
    onSort (field, order) {
      this.sort = { field, order }
      this.loadApplications()
    },
    loadApplications () {
      this.isLoading = true

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
        this.event = event.data.data

        return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/network', { params: this.queryObject })
      }).then((application) => {
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        // Fetching users and bodies.
        for (const pax of this.applications) {
          this.$set(pax, 'newIsOnMemberslist', pax.is_on_memberslist)
          this.$set(pax, 'isSavingOnMemberslist', false)
        }
      }).catch((err) => {
        this.isLoading = false
        if (err.response.status === 404) {
          this.$root.showError('Event is not found')
        } else {
          this.$root.showError('Some error happened', err)
        }

        this.$router.push({ name: 'oms.statutory.list.all' })
      })
    }
  },
  mounted () {
    this.loadApplications()
  }
}
</script>
