<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Network Director listing</h1>

        <div class="field">
          <label class="label" for="network-search">Search by name, surname or statutory ID</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input id="network-search" class="input" type="text" v-model="query" placeholder="Search by name, surname or statutory ID" />
            </div>
          </div>
        </div>

        <div>Total participants: {{ total }}</div>

        <section aria-label="Participants" :aria-busy="isLoading ? 'true' : 'false'">
          <b-table
            :data="applications"
            :loading="isLoading"
            paginated
            backend-pagination
            :total="total"
            :per-page="limit"
            :current-page.sync="page"
            @page-change="onPageChange"
            backend-sorting
            default-sort="statutory_id"
            default-sort-direction="desc"
            v-bind="paginationLabels"
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

            <b-table-column label="Set memberslist status" centered v-slot="props">
              <div class="select" :class="{ 'is-loading': props.row.isSavingOnMemberslist }">
                <select v-model="props.row.newIsOnMemberslist" :aria-label="'Members list status of ' + props.row.first_name + ' ' + props.row.last_name" @change="switchPaxOnMemberslist(props.row)">
                  <option :value="true">Is on memberslist</option>
                  <option :value="false">Is not on memberslist</option>
                </select>
              </div>
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>
        </section>
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
      // The names of the table's pagination buttons.
      paginationLabels: {
        ariaNextLabel: 'Next page',
        ariaPreviousLabel: 'Previous page',
        ariaPageLabel: 'Page',
        ariaCurrentLabel: 'Current page'
      },
      applications: [],
      sort: {
        field: 'id',
        order: 'desc'
      },
      query: '',
      limit: 50,
      offset: 0,
      page: 1,
      total: 0,
      isLoading: false,
      // Counts the list requests, so a late answer to an earlier one is dropped.
      listRequest: 0
    }
  },
  watch: {
    // Another search starts from the first page.
    query () {
      this.offset = 0
      this.page = 1
      this.loadApplications()
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
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
    switchPaxOnMemberslist (pax) {
      pax.isSavingOnMemberslist = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/is_on_memberslist'

      this.axios.put(url, { is_on_memberslist: pax.newIsOnMemberslist }).then(() => {
        pax.is_on_memberslist = pax.newIsOnMemberslist
        pax.isSavingOnMemberslist = false
        this.$root.showSuccess(`Successfully updated memberslist status of application for application #${pax.id}`)
      }).catch((err) => {
        pax.isSavingOnMemberslist = false
        // Showing what is still stored.
        pax.newIsOnMemberslist = pax.is_on_memberslist
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
      // Only the answer to the last search, page or sort counts: a late one for an earlier
      // request is dropped.
      const request = ++this.listRequest
      this.isLoading = true

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/network', { params: this.queryObject }).then((application) => {
        if (request !== this.listRequest) return
        this.applications = application.data.data
        this.total = application.data.meta.count
        this.isLoading = false

        // Fetching users and bodies.
        for (const pax of this.applications) {
          this.$set(pax, 'newIsOnMemberslist', pax.is_on_memberslist)
          this.$set(pax, 'isSavingOnMemberslist', false)
        }
      }).catch((err) => {
        if (request !== this.listRequest) return
        this.isLoading = false
        if (err.response && err.response.status === 404) {
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
