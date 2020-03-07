<template>
  <font-awesome-icon class="icon" :icon="['fa', 'info-circle']" v-tooltip="{
        content: text,
        placement: 'top-center',
        offset: 5,
        delay: {
          show: 100,
          hide: 200
        }}"/>
</template>

<script>
export default {
  name: 'tooltip',
  props: ['text']
}
</script>