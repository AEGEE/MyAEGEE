<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add question line</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Name</label>
        <div class="control">
          <input class="input" type="text" required v-model="questionLine.name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveQuestionLine()">Save changes</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditQuestionLineModal',
  props: ['event', 'questionLine', 'services', 'showSuccess', 'showDanger', 'router'],
  data () {
    return {
      errors: {}
    }
  },
  computed: {
    isNew () {
      return !this.questionLine.id
    }
  },
  methods: {
    saveQuestionLine () {
      this.isLoading = true

      const action = this.isNew
        ? this.axios.post(this.services['oms-statutory'] + '/events/' + this.event.id + '/question-lines/', this.questionLine)
        : this.axios.put(this.services['oms-statutory'] + '/events/' + this.event.id + '/question-lines/' + this.questionLine.id, this.questionLine)

      action.then((response) => {
        this.showSuccess('Question line is created.')

        this.isLoading = false
        this.router.go(0) // Reloading the page.
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors

        this.showDanger(message)
      })
    }
  },
  mounted () {
    
  }
}
</script>