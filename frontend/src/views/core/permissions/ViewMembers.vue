<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h1 class="title">Members who have the permission {{ permission.combined }}</h1>

        <b-table
          :data="members"
          :loading="isLoading">
          <b-table-column field="first_name" label="Name and surname" sortable v-slot="props">
            <router-link :to="{ name: 'oms.members.view', params: { id: props.row.username || props.row.id } }">
              {{ props.row.first_name }} {{ props.row.last_name }}
            </router-link>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'PermissionMembersList',
  data () {
    return {
      members: [],
      permission: {
        combined: ''
      },
      isLoading: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['core'] + '/permissions/' + this.$route.params.id).then((response) => {
        this.permission = response.data.data

        return this.axios.get(this.services['core'] + '/permissions/' + this.$route.params.id + '/members')
      }).then((response) => {
        this.members = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.$root.showError('Could not fetch members', err)
        this.$router.push({ name: 'oms.permissions.view', params: { id: this.$route.params.id } })
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
