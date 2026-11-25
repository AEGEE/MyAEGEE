<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Edit primary body</p>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="primary-body">Primary body</label>
        <div class="control">
          <div class="select">
            <select id="primary-body" v-model="primaryBodyId" class="select">
              <option :value="null">Not set</option>
              <option v-for="body in sortedBodies" :value="body.id" v-bind:key="body.id">{{ body.name }}</option>
            </select>
          </div>
        </div>
      </div>

    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="updatePrimaryBody()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import sortBodies from '../../../methods/sort-bodies'

export default {
  name: 'EditPrimaryBodyModal',
  props: ['member', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      primaryBodyId: null
    }
  },
  computed: {
    sortedBodies () {
      return sortBodies(this.member.bodies)
    }
  },
  methods: {
    updatePrimaryBody () {
      this.axios.put(this.services['core'] + '/members/' + this.member.id + '/primary-body', {
        primary_body_id: this.primaryBodyId
      }).then(() => {
        this.member.primary_body_id = this.primaryBodyId
        this.member.primary_body = this.member.bodies.find((body) => body.id === this.primaryBodyId && ['antenna', 'contact antenna', 'contact'].includes(body.type))
        this.showSuccess('Primary body is updated')
        this.$parent.close()
      }).catch((err) => {
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
