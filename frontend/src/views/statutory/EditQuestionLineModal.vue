<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <h2 class="modal-card-title">{{ isNew ? 'Add question line' : 'Edit question line' }}</h2>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="question-line-name">Name</label>
        <div class="control">
          <input id="question-line-name" class="input" type="text" required v-model="name" />
        </div>
        <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="saveQuestionLine()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditQuestionLineModal',
  props: ['event', 'questionLine', 'services', 'showSuccess', 'showError', 'router'],
  data () {
    return {
      errors: {},
      // The form works on a copy, so the list shows the line as it is stored until it is saved.
      name: this.questionLine.name
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

      // Only the field of the form.
      const questionLine = { name: this.name }
      const action = this.isNew
        ? this.axios.post(this.services['statutory'] + '/events/' + this.event.id + '/question-lines/', questionLine)
        : this.axios.put(this.services['statutory'] + '/events/' + this.event.id + '/question-lines/' + this.questionLine.id, questionLine)

      action.then(() => {
        this.showSuccess(this.isNew ? 'Question line is created.' : 'Question line is updated.')

        this.isLoading = false
        this.router.go(0) // Reloading the page.
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }

        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors
      })
    }
  },
  mounted () {

  }
}
</script>
