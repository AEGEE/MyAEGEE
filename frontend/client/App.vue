<template>
  <div id="app">
    <nprogress-container></nprogress-container>
    <navbar :show="true"></navbar>
    <sidebar :show="sidebar.opened && !sidebar.hidden && $route.meta.showSidebar"></sidebar>
    <app-main></app-main>
    <hr />
    <footer-bar></footer-bar>
  </div>
</template>

<script>
import { Navbar, Sidebar, AppMain, FooterBar } from 'components/layout/'
import { mapGetters, mapActions } from 'vuex'
import NprogressContainer from './components/NProgress.vue'
import methods from './methods'

export default {
  components: {
    Navbar,
    Sidebar,
    AppMain,
    FooterBar,
    NprogressContainer
  },

  beforeMount () {
    const { body } = document
    const WIDTH = 768
    const RATIO = 3

    const handler = () => {
      if (!document.hidden) {
        let rect = body.getBoundingClientRect()
        let isMobile = rect.width - RATIO < WIDTH
        this.toggleDevice(isMobile ? 'mobile' : 'other')
        this.toggleSidebar({
          opened: !isMobile
        })
      }
    }

    document.addEventListener('visibilitychange', handler)
    window.addEventListener('DOMContentLoaded', handler)
    window.addEventListener('resize', handler)
  },

  computed: mapGetters({
    sidebar: 'sidebar'
  }),

  methods: {
    ...mapActions([
      'toggleDevice',
      'toggleSidebar'
    ]),
    ...methods
  }
}
</script>

<style lang="scss">
@import '~flatpickr/dist/flatpickr.css';
@import '~animate.css';
@import '~vue-multiselect/dist/vue-multiselect.min.css';

.animated {
  animation-duration: .377s;
}

@import './styles/main.scss';

html, body, #app, .app-main {
  background-color: #fafafa;
}

.nprogress-container {
  position: fixed !important;
  width: 100%;
  height: 50px;
  z-index: 2048;
  pointer-events: none;

  #nprogress {
    $color: linear-gradient(to right, #c51c13 20%,#a0c514 20%, #a0c514 40%, #981991 40%, #981991 60%, #fbba00 60%, #fbba00 80%, #1468c5 80%);;

    .bar {
      background: $color;
    }
    .peg {
      box-shadow: 0 0 10px $color, 0 0 5px $color;
    }

    .spinner-icon {
      border-top-color: $color;
      border-left-color: $color;
    }
  }
}
</style>
