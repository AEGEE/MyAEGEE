<template>
  <nav
    class="navbar is-fixed-top"
    :class="{ slideInDown: show, slideOutDown: !show }"
    aria-label="Account"
  >
    <div class="navbar-brand">
      <button
        type="button"
        class="navbar-item navbar-control is-hidden-tablet"
        aria-label="Menu"
        :aria-expanded="sidebar.opened ? 'true' : 'false'"
        @click="toggleSidebar({ opened: !sidebar.opened })"
      >
        <font-awesome-icon icon="bars" aria-hidden="true" />
      </button>
      <a href="/" class="logo" aria-label="MyAEGEE home">
        <img src="../../images/AEGEE_logo.png" class="image" alt="" />
      </a>
      <button
        type="button"
        class="navbar-burger burger"
        ref="burger"
        aria-label="Account menu"
        :aria-expanded="navbar.menuOpened ? 'true' : 'false'"
        @click="toggleNavbarMenu({ opened: !navbar.menuOpened })"
      >
        <span aria-hidden="true">
          <font-awesome-icon icon="user" />
        </span>
      </button>
    </div>
    <div class="navbar-menu" ref="menu" :class="{ 'is-active': navbar.menuOpened }" @focusout="closeWhenFocusLeaves">
      <div class="navbar-end">
        <!-- Opens on hover as before, and the button opens it by keyboard and by touch (so
             the hover needs no focus handler of its own). Escape, a click elsewhere and focus
             moving on close it again, also while the pointer is still over it, which a menu
             shown by :hover alone can't do. -->
        <!-- eslint-disable-next-line vuejs-accessibility/mouse-events-have-key-events -->
        <div
          class="navbar-item has-dropdown"
          :class="{ 'is-active': userMenuOpened }"
          v-if="loggedIn && user && user.first_name"
          @mouseenter="openByHover"
          @mouseleave="closeAfterHover"
        >
          <button
            type="button"
            class="navbar-link navbar-control"
            ref="userMenuToggle"
            :aria-expanded="userMenuOpened ? 'true' : 'false'"
            @click="toggleUserMenu"
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
      userMenuOpened: false,
      // Opened by a click, so it stays when the pointer leaves.
      userMenuPinned: false
    }
  },
  computed: mapGetters({
    sidebar: 'sidebar',
    navbar: 'navbar',
    loggedIn: 'loggedIn',
    user: 'user'
  }),
  methods: {
    ...mapActions(['toggleSidebar', 'toggleNavbarMenu']),
    logout () {
      this.closeUserMenu()
      this.$auth.logout().then(() => this.$router.push('/login'))
    },
    openByHover () {
      if (this.userMenuOpened) return
      this.userMenuOpened = true
      this.userMenuPinned = false
    },
    closeAfterHover () {
      if (!this.userMenuPinned) this.userMenuOpened = false
    },
    toggleUserMenu (event) {
      // The second click of a double-click is not a second decision: without this the menu
      // would open and close again under the pointer.
      if (event && event.detail > 1) return
      // A click on a menu that the pointer has just opened (a tap does both) keeps it open.
      const opened = this.userMenuOpened && !this.userMenuPinned ? true : !this.userMenuOpened
      this.userMenuOpened = opened
      this.userMenuPinned = opened
    },
    closeUserMenu () {
      this.userMenuOpened = false
      this.userMenuPinned = false
    },
    // The account menu is the dropdown under the member's name on a desktop, and the whole
    // menu behind the burger button on a phone.
    isMenuOpened () {
      return this.userMenuOpened || this.navbar.menuOpened
    },
    closeMenus () {
      this.closeUserMenu()
      if (this.navbar.menuOpened) this.toggleNavbarMenu({ opened: false })
    },
    closeOnEscape (event) {
      if (event.key !== 'Escape' || !this.isMenuOpened()) return
      // Focus that was in the menu goes back to the button that opened it, so the keyboard
      // stays where it was. A menu the pointer opened had no focus to give back.
      const toggle = this.userMenuOpened ? this.$refs.userMenuToggle : this.$refs.burger
      const hadFocus = this.$refs.menu.contains(document.activeElement)
      this.closeMenus()
      if (hadFocus && toggle) toggle.focus()
    },
    closeWhenFocusLeaves (event) {
      // No `relatedTarget`: the window lost focus, or a click landed on something that takes
      // none. The first is no reason to close, the second is a click outside (below).
      if (!event.relatedTarget || !this.isMenuOpened()) return
      const stays = this.$refs.menu.contains(event.relatedTarget) || (this.$refs.burger && this.$refs.burger.contains(event.relatedTarget))
      if (!stays) this.closeMenus()
    },
    closeOnClickOutside (event) {
      if (!this.isMenuOpened()) return
      const inside = this.$refs.menu.contains(event.target) || (this.$refs.burger && this.$refs.burger.contains(event.target))
      if (!inside) this.closeMenus()
    }
  },
  mounted () {
    // On the document: a click outside is by definition not in this component, and Escape
    // has to work for a menu the pointer opened, when the focus is somewhere else.
    document.addEventListener('click', this.closeOnClickOutside)
    document.addEventListener('keydown', this.closeOnEscape)
  },
  beforeDestroy () {
    document.removeEventListener('click', this.closeOnClickOutside)
    document.removeEventListener('keydown', this.closeOnEscape)
  },
  watch: {
    $route () {
      this.closeUserMenu()
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
