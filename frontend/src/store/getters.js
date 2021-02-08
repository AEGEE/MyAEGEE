const pkg = state => state.pkg
const app = state => state.app
const device = state => state.app.device
const sidebar = state => state.app.sidebar
const navbar = state => state.app.navbar
const effect = state => state.app.effect
const menuitems = state => state.menu.items
const loggedIn = state => state.login.isLoggedIn
const user = state => state.login.user
const permissions = state => state.login.permissions
const services = state => state.services
const componententry = state => state.menu.items.filter(c => c.meta && c.meta.label === 'Components')[0]
const validationErrors = state => state.login.validationErrors
const isValid = state => state.login.isValid

export {
  pkg,
  app,
  device,
  sidebar,
  navbar,
  effect,
  menuitems,
  componententry,
  loggedIn,
  user,
  permissions,
  services,
  validationErrors,
  isValid
}
