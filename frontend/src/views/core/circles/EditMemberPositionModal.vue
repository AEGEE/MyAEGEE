<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Edit user membership</p>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="circle-membership-position">Position</label>
        <div class="control">
          <input id="circle-membership-position" class="input" type="text" v-model="position" />
        </div>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" :disabled="isLoading" @click="updateMembership()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditMemberPositionModal',
  props: ['circle', 'membership', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      // A copy: the list shows the position of the membership, which changes only once it is saved.
      position: this.membership.position,
      isLoading: false
    }
  },
  methods: {
    updateMembership () {
      this.isLoading = true

      this.axios.put(this.services['core'] + '/circles/' + this.circle.id + '/members/' + this.membership.id, {
        position: this.position
      }).then(() => {
        this.membership.position = this.position
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
