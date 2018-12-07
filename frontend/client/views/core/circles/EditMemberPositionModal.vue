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
          <input class="input" type="text" v-model="member.position" />
        </div>
        <p class="help is-danger" v-if="userErrors.position">{{ userErrors.position.join(', ')}}</p>
      </div>

      <div class="field">
        <label class="label">Circle admin?
          <input class="checkbox" type="checkbox" v-model="member.circle_admin" />
        </label>
        <p class="help is-danger" v-if="userErrors.circle_admin">{{ userErrors.circle_admin.join(', ')}}</p>
      </div>
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
  props: ['circle', 'member', 'services', 'showSuccess', 'showDanger'],
  data () {
    return {
      userErrors: {}
    }
  },
  methods: {
    updateMembership () {
      this.isLoading = true

      this.axios.put(this.services['oms-core-elixir'] + '/circles/' + this.circle.id + '/members/' + this.member.id, {
        circle_membership: this.member
      }).then((response) => {
        this.showSuccess('Membership is updated')
        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false

        this.showDanger('Error updating user membership: ' + err.message)
      })
    },
  }
}
</script>