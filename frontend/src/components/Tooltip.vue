<template>
  <button
    type="button"
    class="tooltip-trigger"
    aria-label="More information"
    v-tooltip="{
      content: $options.filters.markdown(text),
      placement: 'top-center',
      trigger: 'hover focus',
      offset: 5,
      delay: {
        show: 100,
        hide: 200,
      },
    }">
    <font-awesome-icon class="icon" :icon="['fa', 'info-circle']" />
  </button>
</template>

<script>
export default {
  name: 'tooltip',
  props: ['text']
}
</script>

<style lang="scss">
/* A button, so the keyboard reaches it, that looks like the icon alone. */
.tooltip-trigger {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  line-height: inherit;
  vertical-align: baseline;
  cursor: help;
}
</style>
