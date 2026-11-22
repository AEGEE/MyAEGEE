// Text colours pass WCAG AA on their background. Must match RESOURCE_THEMES in core/lib/constants.js.
const GREY_DARK = '#434242'
const WHITE = '#ffffff'

export const THEMES = [
  { key: 'blue', label: 'Blue', background: '#1468c5', color: WHITE }, // 5.50:1
  { key: 'blue-dark', label: 'Dark blue', background: '#163e7a', color: WHITE }, // 10.48:1
  { key: 'purple', label: 'Purple', background: '#931991', color: WHITE }, // 7.53:1
  { key: 'red', label: 'Red', background: '#c51c13', color: WHITE }, // 5.92:1
  { key: 'grey', label: 'Dark grey', background: GREY_DARK, color: WHITE }, // 10.02:1
  { key: 'yellow', label: 'Yellow', background: '#fbba00', color: GREY_DARK }, // 5.78:1
  { key: 'green', label: 'Light green', background: '#c2de5d', color: GREY_DARK } // 6.63:1
]

export function themeStyle (key) {
  const theme = THEMES.find(item => item.key === key) || THEMES.find(item => item.key === 'grey')
  return { background: theme.background, color: theme.color }
}

export function isInternal (url) {
  return typeof url === 'string' && url.startsWith('/')
}

export function canManageResources (permissions) {
  return Array.isArray(permissions) && permissions.some(permission => permission.combined === 'global:manage:resources')
}
