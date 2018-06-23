<template>
  <footer class="footer">
    <div class="container">
      <div class="content has-text-centered">
        <p>© 2017 AEGEE - OMS-Frontend version {{ version }}</p>
        <p>Powered by <a href="//oms.aegee.org">Online membership system</a></p>
      </div>

      <article class="footer-message message is-danger">
        <div class="message-header">
          <p>DEBUG BUILD</p>
        </div>
        <div class="message-body">
           <strong>All data is volatile and can be reverted at any time!</strong>
        </div>
      </article>
    </div>
  </footer>
</template>

<script>
export default {

  data () {
    return this.$store.state.pkg
  }

}
</script>

<style lang="scss">
@import "~bulma/sass/utilities/initial-variables";
@import "~bulma/sass/utilities/derived-variables";
@import '~bulma/sass/utilities/mixins';

.footer {
  margin-left: 180px;

  @include mobile() {
    margin-left: 0;
  }

  .footer-message {
    border: 1px solid #ff3860;
  }

  .social a {
    border-bottom: none !important;
  }

  .fa.fa-heart {
    color: red;
  }
}
</style>
