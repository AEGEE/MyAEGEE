const device = state => state.app.device
const sidebar = state => state.app.sidebar
const navbar = state => state.app.navbar
const menuitems = state => state.menu.items
const loggedIn = state => state.login.isLoggedIn
const user = state => state.login.user
const permissions = state => state.login.permissions
const services = state => state.services
const validationErrors = state => state.login.validationErrors
const isValid = state => state.login.isValid

export {
  device,
  sidebar,
  navbar,
  menuitems,
  loggedIn,
  user,
  permissions,
  services,
  validationErrors,
  isValid
}
