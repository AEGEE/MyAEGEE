<template>
  <div class="tile is-ancestor">
    <div class="tile is-vertical is-3">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-4by3">
            <img src="https://bulma.io/images/placeholders/640x480.png">
          </figure>
        </article>
      </div>
      <div class="tile is-parent">
        <article class="tile is-child is-info">
          <div class="field is-grouped">
            <a class="button is-fullwidth is-primary">
              <span>Change picture</span>
              <span class="icon"><i class="fa fa-camera"></i></span>
            </a>
          </div>

          <div class="field is-grouped">
            <a class="button is-fullwidth is-danger">
              <span>Delete profile</span>
              <span class="icon"><i class="fa fa-times"></i></span>
            </a>
          </div>

        </article>
      </div>
    </div>
    <div class="tile is-vertical is-parent">
      <article class="tile is-child">
        <div class="content">
          <p class="title">{{ user.first_name }}</p>
          <p class="subtitle">{{ user.last_name }}</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Profile link</th>
                  <td>/members/{{ user.seo_url || user.id }}</td>
                </tr>
                <tr>
                  <th>Primary body</th>
                  <td>{{ user.primary_body ? user.primary_body.name : '' }}</td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td>{{ user.phone }}</td>
                </tr>
                <tr>
                  <th>Date of birth</th>
                  <td>{{ user.date_of_birth }}</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td>{{ user.gender }}</td>
                </tr>
                <tr>
                  <th>Address</th>
                  <td>{{ user.address }}</td>
                </tr>
                <tr>
                  <th>About me</th>
                  <td>{{ user.about_me }}</td>
                </tr>
                <tr>
                  <th>Is superadmin?</th>
                  <td>{{ (user.user && user.user.superadmin) ? 'Yes' : 'No' }}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>{{ user.user.email }}</td>
                </tr>
                <tr>
                  <th>Username</th>
                  <td>{{ user.user.name }}</td>
                </tr>
                <tr>
                  <th>Login suspended?</th>
                  <td>{{ user.user.active ? 'Yes' : 'No' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.bodies.length">
        <div class="content">
          <p class="subtitle">Bodies</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
                <tr v-for="body in user.bodies" v-bind:key="body.id">
                  <td>{{ body.legacy_key }}</td>
                  <td>{{ body.name }}</td>
                  <td>{{ body.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-if="user.circles.length">
        <div class="content">
          <p class="subtitle">Circles</p>
          <div class="content">
            <table class="table is-narrow">
              <tbody>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
                <tr v-for="circle in user.circles" v-bind:key="circle.id">
                  <td>{{ circle.name }}</td>
                  <td>{{ circle.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
      user: {
        name: '',
        surname: '',
        id: null,
        seo_url: null,
        primary_body: null,
        bodies: null,
        circles: null,
        date_of_birth: null,
        gender: null,
        phone: null
      }
    }
  },
  mounted () {
    this.axios.get(services['oms-core-elixir'] + '/members/' + this.$route.params.id).then((response) => {
      this.user = response.data.data
    })
  }
}
</script>
