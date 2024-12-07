<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Edit primary body</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Primary body</label>
        <div class="control">
          <div class="select">
            <select v-model="primaryBodyId" class="select">
              <option :value="null">Not set</option>
              <option v-for="body in member.bodies" :value="body.id" v-bind:key="body.id">{{ body.name }}</option>
            </select>
          </div>
        </div>
        <p class="help is-danger" v-if="userErrors.position">{{ userErrors.position.join(', ')}}</p>
      </div>

    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="updatePrimaryBody()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditPrimaryBodyModal',
  props: ['member', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      userErrors: {},
      primaryBodyId: null
    }
  },
  methods: {
    updatePrimaryBody () {
      this.isLoading = true

      this.axios.put(this.services['core'] + '/members/' + this.member.id + '/primary-body', {
        primary_body_id: this.primaryBodyId
      }).then(() => {
        this.member.primary_body_id = this.primaryBodyId
        this.member.primary_body = this.member.bodies.find((body) => body.id === this.primaryBodyId && ['antenna', 'contact antenna', 'contact'].includes(body.type))
        this.showSuccess('Primary body is updated')
        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false

        this.showError('Error updating primary body', err)
      })
    }
  },
  mounted () {
    if (this.member.primary_body_id) {
      this.primaryBodyId = this.member.primary_body_id
    }
  }
}
</script>
