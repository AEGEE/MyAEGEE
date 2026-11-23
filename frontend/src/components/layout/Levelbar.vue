<template>
  <div class="level app-levelbar">
    <div class="level-left">
      <div class="level-item">
        <h3 class="subtitle is-5">
          <strong>{{ name }}</strong>
        </h3>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    name () {
      return this.$route.meta.label
    }
  }
}
</script>
