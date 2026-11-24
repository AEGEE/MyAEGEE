<template>
  <aside class="menu app-sidebar" :class="{ 'is-visible': show, 'is-hidden': !show, 'is-menu-opened': navbar.menuOpened }">
    <nav aria-label="Main menu">
      <div v-for="category in filteredMenu" v-bind:key="category.categoryName">
        <h2 class="menu-label" :id="`menu-category-${category.index}`">
          {{ category.categoryName }}
        </h2>
        <ul class="menu-list" :aria-labelledby="`menu-category-${category.index}`">
          <li v-for="item in category.components" v-bind:key="item.name">
            <router-link :to="{ name: item.name, params: item.params }" exact v-if="item.name && !item.link">
              <span><font-awesome-icon :icon="['fas', item.icon]" /></span>
              {{ item.label }}
            </router-link>
            <button type="button" class="menu-toggle" :aria-expanded="isExpanded(item) ? 'true' : 'false'" v-else-if="!item.link" @click="toggle(item.index, category.index, item)">
              <span><font-awesome-icon :icon="['fas', item.icon]" /></span>
              {{ item.label }}
              <span class="icon is-small is-angle" v-if="item.children && item.children.length">
                <font-awesome-icon :icon="['fa', 'angle-down']" />
              </span>
            </button>
            <a :href="item.link" target="_blank" rel="noopener noreferrer" v-else>
              <span><font-awesome-icon :icon="['fas', item.icon]" /></span>
              {{ item.label }}
            </a>

            <ul v-show="isExpanded(item)">
              <li v-for="subItem in item.children" v-bind:key="subItem.name">
                <router-link :to="{ name: subItem.name }" exact>
                  {{ subItem.label }}
                </router-link>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  props: {
    show: Boolean
  },
  data () {
    return {
      isReady: false
    }
  },
  mounted () {
    const route = this.$route
    if (route.name) {
      this.isReady = true
      this.shouldExpandMatchItem(route)
    }
  },
  computed: {
    ...mapGetters({
      menu: 'menuitems',
      permissions: 'permissions',
      navbar: 'navbar',
      device: 'device',
      loginUser: 'user'
    }),
    filteredMenu () {
      const setPreviousIndex = (item, index) => {
        // we need the original positions of items in the menu
        // in case they were shifted
        item.index = index
        return item
      }

      let newMenu = JSON.parse(JSON.stringify(this.menu))

      // structure: menu => array of categories => array of components => (probably) array of children
      for (const category of newMenu) {
        for (const component of category.components) {
          // first, remove all children you don't have permissions to
          // and before that, saving the original index
          if (Array.isArray(component.children)) {
            component.children = component.children
              .map(setPreviousIndex)
              .filter(child => this.userHasPermissions(child) && this.canAccessUnauthorized(child))
          }
        }

        // remove all components that have no children (either empty or removed because no permissions)
        // and then remove all components you don't have permissions to
        category.components = category.components
          .map(setPreviousIndex)
          .filter(component => !Array.isArray(component.children) || component.children.length > 0)
          .filter(component => this.userHasPermissions(component) && this.canAccessUnauthorized(component))
      }

      // then removing categories when you don't have any components inside
      newMenu = newMenu
        .map(setPreviousIndex)
        .filter(category => category.components.length > 0 && this.canAccessUnauthorized(category))

      return newMenu
    }
  },
  methods: {
    ...mapActions([
      'expandMenu',
      'toggleSidebar',
      'toggleNavbarMenu'
    ]),
    canAccessUnauthorized (item) {
      // Do not show menu entry for authorized-only pages when not logged in.
      if (!this.loginUser && item.auth === 'logged-in') {
        return false
      }

      // Do not show menu entry for unauthorized-only pages when logged in.
      if (this.loginUser && item.auth === 'not-logged-in') {
        return false
      }

      return true
    },
    userHasPermissions (item) {
      // If item has no permissions attribute, show it.
      if (!item.permissions) {
        return true
      }

      // Otherwise, check if user has such a permission.
      return item.permissions.some(itemPermission => this.permissions.find(userPermission => userPermission.combined.includes(itemPermission)))
    },
    isExpanded (item) {
      return item.expanded
    },
    toggle (index, categoryIndex, item) {
      this.expandMenu({
        index,
        categoryIndex,
        expanded: !item.expanded
      })
    },
    shouldExpandMatchItem (route) {
      const matched = route.matched
      if (matched.length === 0) {
        return
      }

      const lastMatched = matched[matched.length - 1]
      let parent = lastMatched.parent || lastMatched
      const isParent = parent === lastMatched

      if (isParent) {
        const p = this.findParentFromMenu(route)
        if (p) {
          parent = p
        }
      }

      if ('expanded' in parent && !isParent) {
        this.expandMenu({
          item: parent,
          expanded: true
        })
      }
    },
    findParentFromMenu (route) {
      const menu = this.menu
      for (let i = 0, l = menu.length; i < l; i++) {
        const item = menu[i]
        const k = item.children && item.children.length
        if (k) {
          for (let j = 0; j < k; j++) {
            if (item.children[j].name === route.name) {
              return item
            }
          }
        }
      }
    }
  },
  watch: {
    $route (route) {
      this.isReady = true
      this.shouldExpandMatchItem(route)
      if (this.device.isMobile) {
        this.toggleSidebar({ opened: false })
        this.toggleNavbarMenu({ opened: false })
      }
    }
  }

}
</script>

<style lang="scss">
@import "~bulma/sass/utilities/initial-variables";
@import "~bulma/sass/utilities/derived-variables";
@import '~bulma/sass/utilities/mixins';

.app-sidebar {
  position: fixed;
  z-index: 1;
  top: 53px;
  left: 0;
  bottom: 0;
  padding: 20px 0 50px;
  width: 180px;
  min-width: 45px;
  max-height: 100vh;
  height: calc(100% - 50px);
  background: #FFF;
  box-shadow: 0 2px 3px rgba(17, 17, 17, 0.1), 0 0 0 1px rgba(17, 17, 17, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
  transition: transform .377s ease, opacity .377s ease;

  &.is-visible {
    opacity: 1;
  }

  &.is-hidden {
    opacity: 0;
  }

  @include mobile() {
    &.is-visible {
      transform: translate3d(0, 0, 0);
    }

    &.is-hidden {
      transform: translate3d(-180px, 0, 0);
    }
  }

  &.is-menu-opened {
    @include mobile() {
      transform: translate3d(-180px, 0, 0);
      padding-top: 160px;
      /* Pushed off the screen by the account menu: out of reach for the keyboard and screen
         readers too, once it has slid away. */
      visibility: hidden;
      transition: transform .377s ease, opacity .377s ease, visibility 0s linear .377s;
    }

    @include tablet-only() {
      padding-top: 160px
    }
  }

  .icon {
    vertical-align: baseline;
    &.is-angle {
      position: absolute;
      right: 10px;
      transition: transform .377s ease;
    }
  }

  .menu-label {
    padding-left: 10px;
    margin-top: 1em;
    /* Bulma's light grey is too faint for text this small (4.5:1 is the minimum). */
    color: #666;
  }

  .menu-list {
    /* The toggle of a group looks like the links around it (Bulma's .menu-list a). */
    li button.menu-toggle {
      display: block;
      width: 100%;
      padding: 0.5em 0.75em;
      border: 0;
      border-radius: $radius-small;
      background: none;
      color: $text;
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:hover {
        background-color: $background;
        color: $text-strong;
      }

      &[aria-expanded="true"] {
        .is-angle {
          transform: rotate(180deg);
        }
      }
    }

    li button.menu-toggle + ul {
      margin: 0 10px 0 15px;
    }
  }

}
</style>
