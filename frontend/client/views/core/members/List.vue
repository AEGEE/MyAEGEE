<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <article class="tile is-child box">
        <h4 class="title">Table Responsive</h4>
        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name and surname</th>
                <th>Birthday</th>
                <th>Link</th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>User ID</th>
                <th>Name and surname</th>
                <th>Birthday</th>
                <th>Link</th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="user in users" v-bind:key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.first_name + ' ' + user.last_name }}</td>
                <td>{{ user.date_of_birth }}</td>
                <td>
                  <router-link :to="{ name: 'View single member', params: { id: user.seo_url || user.id } }">
                    {{ '/members/' + (user.seo_url || user.id) }}
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import services from '../../../services.json'

export default {
  data () {
    return {
      users: []
    }
  },
  mounted () {
    this.axios.get(services['oms-core-elixir'] + '/members').then((response) => {
      this.users = response.data.data
    })
  }
}
</script>
