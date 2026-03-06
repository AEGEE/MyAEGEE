if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {}
  })
}

if (!window.scrollTo) {
  window.scrollTo = () => {}
}
