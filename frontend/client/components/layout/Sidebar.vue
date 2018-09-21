<template>
  <aside class="menu app-sidebar animated" :class="{ slideInLeft: show, slideOutLeft: !show }">
    <div v-for="(category, categoryIndex) in menu" v-bind:key="category.categoryName">
      <p class="menu-label">
        {{ category.categoryName }}
      </p>
      <ul class="menu-list">
        <li v-for="(item, index) in category.components" v-bind:key="item.name" v-if="!item.meta.skipMenu && userHasPermissions(item)">
          <router-link :to="{ name: item.name }" exact="true" :aria-expanded="isExpanded(item) ? 'true' : 'false'" v-if="item.path" @click.native="toggle(index, categoryIndex, item)">
            <span class="icon is-small"><i :class="['fa', item.meta.icon]"></i></span>
            {{ item.meta.label || item.name }}
            <span class="icon is-small is-angle" v-if="item.children && item.children.length">
              <i class="fa fa-angle-down"></i>
            </span>
          </router-link>
          <a :aria-expanded="isExpanded(item)" v-else @click="toggle(index, categoryIndex, item)">
            <span class="icon is-small"><i :class="['fa', item.meta.icon]"></i></span>
            {{ item.meta.label || item.name }}
            <span class="icon is-small is-angle" v-if="item.children && item.children.length">
              <i class="fa fa-angle-down"></i>
            </span>
          </a>

          <expanding v-if="item.children && item.children.length">
            <ul v-show="isExpanded(item)">
              <li v-for="subItem in item.children" v-bind:key="subItem.name" v-if="subItem.path && !subItem.meta.skipMenu && userHasPermissions(subItem)">
                <router-link :to="{ name: subItem.name }" exact="true">
                  {{ subItem.meta ? subItem.meta.label : subItem.name }}
                </router-link>
              </li>
            </ul>
          </expanding>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script>
import Expanding from 'vue-bulma-expanding'
import { mapGetters, mapActions } from 'vuex'

export default {
  components: {
    Expanding
  },

  props: {
    show: Boolean
  },

  data () {
    return {
      isReady: false
    }
  },
  mounted () {
    let route = this.$route
    if (route.name) {
      this.isReady = true
      this.shouldExpandMatchItem(route)
    }
  },

  computed: mapGetters({
    menu: 'menuitems',
    permissions: 'permissions'
  }),

  methods: {
    ...mapActions([
      'expandMenu'
    ]),

    userHasPermissions (item) {
      // If item has no meta.permissions attribute, show it.
      if (!item.meta.permissions) {
        return true;
      }

      // Otherwise, check if user has such a permission.
      return item.meta.permissions.some(itemPermission =>
        this.permissions.find(userPermission => userPermission.combined.includes(itemPermission)));
    },

    isExpanded (item) {
      return item.meta.expanded
    },

    toggle (index, categoryIndex, item) {
      this.expandMenu({
        index: index,
        categoryIndex: categoryIndex,
        expanded: !item.meta.expanded
      })
    },

    shouldExpandMatchItem (route) {
      let matched = route.matched
      let lastMatched = matched[matched.length - 1]
      let parent = lastMatched.parent || lastMatched
      const isParent = parent === lastMatched

      if (isParent) {
        const p = this.findParentFromMenu(route)
        if (p) {
          parent = p
        }
      }

      if ('expanded' in parent.meta && !isParent) {
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

  @include mobile() {
    transform: translate3d(-180px, 0, 0);
  }

  @include tablet-only() {
    padding-top: 100px
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
  }

  .menu-list {
    li a {
      &[aria-expanded="true"] {
        .is-angle {
          transform: rotate(180deg);
        }
      }
    }

    li a + ul {
      margin: 0 10px 0 15px;
    }
  }

}
</style>
