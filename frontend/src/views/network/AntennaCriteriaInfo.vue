<template>
  <div class="modal-card" style="height: 75vh">
    <header class="modal-card-head">
      <p class="modal-card-title">{{ local.name }}</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <template v-if="!local.comments">
        <i>No comments to display for this body!</i>
      </template>

      <template v-else>
        <div v-for="(value, key) in this.local.comments" :key="key">
          <span v-if="value != '' & value != null">
            <strong>{{ key.charAt(0).toUpperCase() + key.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() }}: </strong>
            {{ value }}
          </span>
        </div>
      </template>
    </section>

    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'AntennaCriteriaInfo',
  props: ['local', 'agora', 'services', 'showError', 'showSuccess', 'router']
}

</script>
