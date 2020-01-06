import * as types from '../mutation-types'

const state = {
  device: {
    isMobile: false,
    isTablet: false
  },
  sidebar: {
    opened: false
  },
  effect: {
    translate3d: true
  },
  navbar: {
    menuOpened: false
  }
}

const mutations = {
  [types.TOGGLE_DEVICE] (newState, device) {
    newState.device.isMobile = device === 'mobile'
    newState.device.isTablet = device === 'tablet'
  },

  [types.TOGGLE_NAVBAR_MENU] (newState, config) {
    if (config.hasOwnProperty('opened')) {
      newState.navbar.menuOpened = config.opened
    } else {
      newState.navbar.menuOpened = false
    }
  },

  [types.TOGGLE_SIDEBAR] (newState, config) {
    if (config.hasOwnProperty('opened')) {
      newState.sidebar.opened = config.opened
    } else {
      newState.sidebar.opened = true
    }
  },

  [types.SWITCH_EFFECT] (newState, effectItem) {
    for (const name in effectItem) {
      newState.effect[name] = effectItem[name]
    }
  }
}

export default {
  state,
  mutations
}
