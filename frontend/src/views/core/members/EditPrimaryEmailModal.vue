<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Set primary email</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>

    <section class="modal-card-body">
      <div class="field">
        <label class="label">
          Primary email
          <tooltip text="Your primary email is the place where you receive updates from MyAEGEE" />
        </label>
        <b-field>
          <b-radio-button v-model="primaryEmail" native-value="personal">
            {{ member.email }}
          </b-radio-button>

          <b-radio-button v-model="primaryEmail" native-value="gsuite">
            {{ member.gsuite_id }}
          </b-radio-button>
        </b-field>

      </div>
    </section>

    <footer class="modal-card-foot">
      <button class="button is-primary" @click="updatePrimaryEmail()">Save changes</button>
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
      primaryEmail: ''
    }
  },
  methods: {
    updatePrimaryEmail () {
      this.isLoading = true

      this.axios.put(this.services['core'] + '/members/' + this.member.id, {
        primary_email: this.primaryEmail
      }).then(() => {
        this.member.primary_email = this.primaryEmail
        this.showSuccess('Primary email is updated')
        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false

        this.showError('Error updating primary email', err)
      })
    }
  },
  mounted () {
    this.primaryEmail = this.member.primary_email
  }
}
</script>
