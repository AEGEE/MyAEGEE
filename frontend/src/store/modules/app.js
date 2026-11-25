import * as types from '../mutation-types'

const state = {
  device: {
    isMobile: false
  },
  sidebar: {
    opened: false
  },
  navbar: {
    menuOpened: false
  }
}

const mutations = {
  [types.TOGGLE_DEVICE] (newState, device) {
    newState.device.isMobile = device === 'mobile'
  },

  [types.TOGGLE_NAVBAR_MENU] (newState, { opened }) {
    newState.navbar.menuOpened = opened
  },

  [types.TOGGLE_SIDEBAR] (newState, { opened }) {
    newState.sidebar.opened = opened
  }
}

export default {
  state,
  mutations
}
