<template>
  <nav class="navbar is-fixed-top" :class="{ slideInDown: show, slideOutDown: !show }">
    <div class="navbar-start">
      <a class="navbar-item is-hidden-tablet" @click="toggleSidebar({opened: !sidebar.opened})">
        <i class="fa fa-bars" aria-hidden="true" v-show="!sidebar.hidden"></i>
      </a>
    </div>
    <div class="navbar-end is-flex">
      <div class="navbar-item has-dropdown is-hoverable" v-if="loggedIn && user && user.first_name">
        <a class="navbar-link">
          {{ user.first_name + ' ' + user.last_name }}
        </a>

        <div class="navbar-dropdown is-right">
          <router-link to="/members/me" class="navbar-item">See my account</router-link>
          <hr class="navbar-divider" />
          <a class="navbar-item" @click="logout">Logout</a>
        </div>
      </div>

      <router-link v-if="!loggedIn" to="/login" class="navbar-item">Login</router-link>
    </div>
  </nav>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  props: {
    show: Boolean
  },

  computed: mapGetters({
    pkginfo: 'pkg',
    sidebar: 'sidebar',
    loggedIn: 'loggedIn',
    user: 'user',
    permissions: 'permissions'
  }),

  methods: {
    ...mapActions([
      'toggleSidebar'
    ]),
    logout () {
      this.$auth.logout().then(() => this.$router.push('/login'))
    }
  }
}
</script>

<style lang="scss">
@import "~bulma/sass/utilities/initial-variables";
@import "~bulma/sass/utilities/derived-variables";
@import "~bulma/sass/utilities/mixins";

.navbar {
  position: fixed;
  min-width: 100%;
  box-shadow: 0 2px 3px rgba(17, 17, 17, 0.1), 0 0 0 1px rgba(17, 17, 17, 0.1);
  background-color: #fff;

  .container {
    margin: auto 10px;
  }
}

.hero-brand {
  .vue {
    margin-left: 10px;
    color: #36AC70;
  }
  .admin {
    color: #28374B;
  }
}
</style>
