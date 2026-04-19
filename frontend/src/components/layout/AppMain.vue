<template>
  <section
    class="app-main"
    :style="[hiddenSidebarStyle]"
    :class="{ 'is-menu-opened': navbar.menuOpened }"
  >
    <div class="container is-fluid is-marginless app-content">
      <levelbar />
      <transition name="route-fade" mode="out-in" appear>
        <div class="box">
          <router-view />
        </div>
      </transition>
    </div>
  </section>
</template>

<script>
import { mapGetters } from 'vuex'
import Levelbar from './Levelbar'

export default {
  computed: {
    ...mapGetters({
      sidebar: 'sidebar',
      navbar: 'navbar'
    }),
    hiddenSidebarStyle () {
      return this.sidebar.opened ? null : { 'margin-left': 0 }
    }
  },
  components: {
    Levelbar
  }
}
</script>

<style lang="scss">
@import '~bulma/sass/utilities/initial-variables';
@import '~bulma/sass/utilities/derived-variables';
@import '~bulma/sass/utilities/mixins';

html {
  background-color: #fafafa;
}

.app-main {
  padding-top: 50px;
  margin-left: 180px;
  transform: translate3d(0, 0, 0);

  @include mobile() {
    margin-left: 0;
  }

  &.is-menu-opened {
    @include mobile() {
      padding-top: 200px;
    }

    @include tablet-only() {
      padding-top: 200px;
    }
  }
}

.app-content {
  padding: 20px;
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition: opacity .377s ease, transform .377s ease;
}

.route-fade-enter,
.route-fade-leave-to {
  opacity: 0;
  transform: translate3d(0, 8px, 0);
}
</style>
