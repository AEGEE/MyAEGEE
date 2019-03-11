<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Name</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="admin in admins" v-bind:key="admin.id">
                <td><router-link :to="{name: 'oms.members.view', params: {id: admin.user_id}}">name hidden for privacy reasons</router-link></td>
              </tr>

              <tr v-show="!admins.length && !isLoading">
                <td colspan="4" class="has-text-centered">Shop admin list is empty</td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="4" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
              </tr>
            </tbody>
          </table>

        </div>
      </article>
    </div>
  </div>
</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ShopAdminsList',
  data () {
    return {
      admins: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  methods: {
    fetchData () {
      this.isLoading = true

      this.axios.get(this.services['alastair'] + '/shops/' + this.$route.params.id + '/admins').then((response) => {
        this.admins = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.$root.showDanger('Could not fetch shop admin list: ' + err.message)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
