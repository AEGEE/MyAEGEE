<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <h2 class="modal-card-title">{{ isNew ? 'Ask a question' : 'Edit question' }}</h2>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="notification is-info" v-if="event.url === 'spring-agora-novi-sad-2022'">
        The requests for a place in a question line for elections are as follows:<br>
        1 - a question to one candidate<br>
        2 - a question to more candidates (not a yes or no question)<br>
        3 - a yes or no question to more candidates<br>
        4 - more than one question to one candidate<br>
        5 - more than one question to more candidates<br>
        <br>
        The requests for a place in a question line for other topics are as follows:<br>
        I - Question<br>
        O - Objection
      </div>
      <div class="field">
        <label class="label" for="question-text">Text</label>
        <div class="control">
          <textarea id="question-text" class="textarea" required v-model="text" />
        </div>
        <p class="help is-danger" v-if="errors.text">{{ errors.text.join(', ')}}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" :disabled="isLoading" @click="saveQuestion()">Save changes</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'EditQuestionModal',
  props: ['event', 'questionLine', 'question', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      isLoading: true,
      errors: {},
      // The form works on a copy, so the list shows the question as it is stored until it is saved.
      text: this.question.text
    }
  },
  computed: {
    isNew () {
      return !this.question.id
    }
  },
  methods: {
    saveQuestion () {
      this.isLoading = true

      // Only the field of the form.
      const question = { text: this.text }
      const action = this.isNew
        ? this.axios.post(this.services['statutory'] + '/events/' + this.event.id + '/question-lines/' + this.questionLine.id + '/questions/', question)
        : this.axios.put(this.services['statutory'] + '/events/' + this.event.id + '/question-lines/' + this.questionLine.id + '/questions/' + this.question.id, question)

      action.then(() => {
        this.showSuccess(this.isNew ? 'Question is created.' : 'Question is updated.')

        // The page shows the saved one from the service.
        this.$emit('saved')
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }
      })
    }
  },
  mounted () {
    this.isLoading = false
  }
}
</script>
