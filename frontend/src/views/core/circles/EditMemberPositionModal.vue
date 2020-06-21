<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Edit user membership</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Position</label>
        <div class="control">
          <input class="input" type="text" v-model="membership.position" />
        </div>
        <p class="help is-danger" v-if="userErrors.position">{{ userErrors.position.join(', ')}}</p>
      </div>

      <!-- <div class="field">
        <label class="label">Circle admin?
          <input class="checkbox" type="checkbox" v-model="user.circle_admin" />
        </label>
        <p class="help is-danger" v-if="userErrors.circle_admin">{{ userErrors.circle_admin.join(', ')}}</p>
      </div> -->
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="updateMembership()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditMemberPositionModal',
  props: ['circle', 'membership', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      userErrors: {}
    }
  },
  methods: {
    updateMembership () {
      this.isLoading = true

      this.axios.put(this.services['core'] + '/circles/' + this.circle.id + '/members/' + this.membership.id, {
        position: this.membership.position
      }).then(() => {
        this.showSuccess('Membership is updated')
        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false

        this.showError('Error updating user membership', err)
      })
    }
  }
}
</script>
