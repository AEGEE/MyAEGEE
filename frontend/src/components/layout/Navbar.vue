<template>
  <nav class="navbar is-fixed-top" :class="{ slideInDown: show, slideOutDown: !show }" aria-label="Account">
    <div class="navbar-brand">
      <button
        type="button"
        class="navbar-item navbar-control is-hidden-tablet"
        aria-label="Menu"
        :aria-expanded="sidebar.opened ? 'true' : 'false'"
        @click="toggleSidebar({ opened: !sidebar.opened })"
      >
        <font-awesome-icon icon="bars" aria-hidden="true" v-show="!sidebar.hidden" />
      </button>
      <a href="/" class="logo" aria-label="MyAEGEE home">
        <img src="../../images/AEGEE_logo.png" class="image" alt="" />
      </a>
      <button
        type="button"
        class="navbar-burger burger"
        aria-label="Account menu"
        :aria-expanded="navbar.menuOpened ? 'true' : 'false'"
        @click="toggleNavbarMenu({ opened: !navbar.menuOpened })"
      >
        <span aria-hidden="true">
          <font-awesome-icon icon="user" />
        </span>
      </button>
    </div>
    <div class="navbar-menu" :class="{ 'is-active': navbar.menuOpened }">
      <div class="navbar-end">
        <div
          class="navbar-item has-dropdown is-hoverable"
          :class="{ 'is-active': userMenuOpened }"
          v-if="loggedIn && user && user.first_name"
        >
          <!-- Opens on hover as before; the button also opens it by keyboard and by touch. -->
          <button
            type="button"
            class="navbar-link navbar-control"
            :aria-expanded="userMenuOpened ? 'true' : 'false'"
            @click="userMenuOpened = !userMenuOpened"
          >
            {{ user.first_name + ' ' + user.last_name }}
          </button>

          <div class="navbar-dropdown is-right">
            <router-link to="/members/me" class="navbar-item">See my account</router-link>
            <hr class="navbar-divider" />
            <button type="button" class="navbar-item navbar-control" @click="logout">Logout</button>
          </div>
        </div>

        <router-link v-if="!loggedIn" to="/login" class="navbar-item">Login</router-link>
      </div>
    </div>
  </nav>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  props: {
    show: Boolean
  },
  data () {
    return {
      userMenuOpened: false
    }
  },
  computed: mapGetters({
    pkginfo: 'pkg',
    sidebar: 'sidebar',
    navbar: 'navbar',
    loggedIn: 'loggedIn',
    user: 'user',
    permissions: 'permissions'
  }),
  methods: {
    ...mapActions(['toggleSidebar', 'toggleNavbarMenu']),
    logout () {
      this.userMenuOpened = false
      this.$auth.logout().then(() => this.$router.push('/login'))
    }
  },
  watch: {
    $route () {
      this.userMenuOpened = false
    }
  }
}
</script>

<style lang="scss">
@import '~bulma/sass/utilities/initial-variables';
@import '~bulma/sass/utilities/derived-variables';
@import '~bulma/sass/utilities/mixins';

.navbar {
  position: fixed;
  min-width: 100%;
  box-shadow: 0 2px 3px rgba(17, 17, 17, 0.1), 0 0 0 1px rgba(17, 17, 17, 0.1);
  background-color: #fff;

  .container {
    margin: auto 10px;
  }

  /* Buttons that look like the links next to them. */
  button.navbar-control {
    background: none;
    border: 0;
    font: inherit;
    cursor: pointer;
  }

  .navbar-dropdown button.navbar-control {
    width: 100%;
    text-align: left;
  }

  /* for the logo in the navbar */
  .logo {
    .image {
      height: 52px;
      padding: 3px;
      padding-left: 10px;
    }
  }

  .navbar-burger {
    span {
      height: 0;

      &:first-child {
        top: calc(50% - 12px);
      }
    }
  }
}

.hero-brand {
  .vue {
    margin-left: 10px;
    color: #36ac70;
  }
  .admin {
    color: #28374b;
  }
}
</style>
