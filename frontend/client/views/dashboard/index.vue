<template>
  <div>
    <div class="tile is-ancestor">
      <div class="tile is-vertical is-12">
        <div class="tile">
          <div class="tile is-6 is-parent">
            <article class="tile is-child box">
              <p class="title">{{ user.first_name }} {{ user.last_name }}</p>
              <div class="content">
                <p>You are member of these bodies:</p>
                <ul>
                  <li v-for="body in user.bodies" v-bind:key="body.id">
                    <router-link :to="{ name: 'oms.bodies.view', params: { id: body.id} }">{{ body.name }}</router-link>
                  </li>
                </ul>
                <p>You are member of these circles:</p>
                <ul>
                  <li v-for="circle in user.circles" v-bind:key="circle.id">
                    <router-link :to="{ name: 'oms.circles.view', params: { id: circle.id} }">{{ circle.name }}</router-link>
                  </li>
                </ul>
              </div>

              <b-loading :is-full-page="false" :active.sync="isUserLoading"></b-loading>
            </article>
          </div>
          <div class="tile is-6 is-parent">
            <article class="tile is-child box">
              <p class="title">Events you've applied to</p>
              <p class="subtitle">Not implemented yet.</p>
              <div class="content">
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin ornare magna eros, eu pellentesque tortor vestibulum ut. Maecenas non massa sem. Etiam finibus odio quis feugiat facilisis.</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Dashboard',
  data () {
    return {
      user: {
        first_name: '',
        last_name: '',
        bodies: [],
        circles: []
      },
      isUserLoading: false
    }
  },
  mounted () {
    this.isUserLoading = true
    this.axios.get(this.services['oms-core-elixir'] + '/members/me').then((response) => {
      this.user = response.data.data
      this.isUserLoading = false
    }).catch((err) => {
      this.isUserLoading = false
      let message = 'Some error happened: ' + err.message

      this.$toast.open({
        duration: 3000,
        message,
        type: 'is-danger'
      })
    })
  },
  computed: mapGetters({
    loginUser: 'user',
    services: 'services'
  })
}
</script>
