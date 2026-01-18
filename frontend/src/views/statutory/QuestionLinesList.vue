<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Question lines list</div>

        <div class="notification is-info" v-if="$route.params.id === 'spring-agora-novi-sad-2022'">
          Every Agora participant can request a place in the question line in real time by <b>entering the corresponding number</b>.<br>
          In case you are a visitor, your submitted question line place request will be considered as a request for speaking rights as well.<br>
          Based on the time left, the Chair will decide how many questions will be accepted and evaluate if they will grant speaking rights to individuals.<br>
          The questions are not anonymous, the name, Local/Body and participant status of the person asking a question will be visible to everyone else attending the Agora.<br>
          The Chair reserves the right to delete requests that do not conform to the rules listed underneath this text, are offensive or disrupt the order of the Agora.
        </div>

        <div class="notification is-info" v-if="$route.params.id === 'spring-agora-enschede-2023'">
          Every Agora participant can request a place in the question line in real time by <b>entering the corresponding number</b>.<br>
          In case you are a visitor, your submitted question line place request will be considered as a request for speaking rights as well.<br>
          Based on the time left, the Chair will decide how many questions will be accepted and evaluate if they will grant speaking rights to individuals.<br>
          The questions are not anonymous, the name, Local/Body and participant status of the person asking a question will be visible to everyone else attending the Agora.<br>
          The Chair reserves the right to delete requests that do not conform to the rules listed underneath this text, are offensive or disrupt the order of the Agora.<br>
          <br>
          Online question lines will be used only for candidates.<br>
          Chair Team will inform you when the question line will open and how much time you have to ask.<br>
          You can ask as many questions as you wish, writing either A or B for every question you would like to ask. You do not have to write the whole question in the online box!<br>
          <br>
          Meaning of letters to write:<br>
          A - one question to one candidate<br>
          B - one question to few candidates (including yes or no questions)<br>
          <br>
          For each new question you have to submit a new response of A or B, putting A five times in one question will not be considered as a request for five different questions for example.<br>
        </div>

        <div class="notification is-info" v-if="$route.params.id === 'spring-agora-novi-sad-2024'">
          Every Agora participant can request a place in the question line in real time by <b>entering the corresponding number</b>.<br>
          In case you are a visitor or observer, your submitted question line place request will be considered as a request for speaking rights as well.<br>
          Based on the time left, the Chair will decide how many questions will be accepted and evaluate if they will grant speaking rights to individuals.<br>
          The questions are not anonymous, the name, Local/Body and participant status of the person asking a question will be visible to everyone else attending the Agora.<br>
          The Chair reserves the right to delete requests that do not conform to the rules listed underneath this text, are offensive or disrupt the order of the Agora.<br>
          <br>
          Online question lines will be used only for candidates.<br>
          Chair Team will inform you when the question line will open and how much time you have to ask.<br>
          You can ask as many questions as you wish, writing either A or B for every question you would like to ask. You do not have to write the whole question in the online box!<br>
          <br>
          Meaning of letters to write:<br>
          A - one question to one candidate<br>
          B - one yes or no question to few candidates<br>
          <br>
          For each new question you have to submit a new response of A or B, putting A five times in one question will not be considered as a request for five different questions for example.<br>
        </div>

        <div class="field" v-if="can.manage_question_lines">
          <div class="control">
            <button class="button is-primary" @click="openCreateQuestionLineModal">Create a question line</button>
          </div>
        </div>

        <b-table :data="questionLines" :loading="isLoading" :selected.sync="selectedQuestionLine" narrowed>
          <b-table-column field="id" label="#" numeric v-slot="props">
            {{ props.index + 1 }}
          </b-table-column>

          <b-table-column field="name" label="Name" v-slot="props">
            {{ props.row.name }}
          </b-table-column>

          <b-table-column label="Questions" numeric v-slot="props">
            {{ props.row.questions.length }}
          </b-table-column>

          <b-table-column field="starts" label="Status" centered v-slot="props">
            <span
              class="tag"
              v-if="!can.manage_question_lines"
              :class="props.row.status === 'open' ? 'is-primary' : 'is-danger'">
              {{ props.row.status }}
            </span>
            <div v-else class="select is-small" :class="{ 'is-loading': props.row.isSaving }">
              <select v-model="props.row.newStatus" @change="switchQuestionLineStatus(props.row)">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </b-table-column>

          <b-table-column label="Edit" centered v-if="can.manage_question_lines" v-slot="props">
            <a href="#" class="button is-warning is-small" @click.prevent="openEditQuestionLineModal(props.row)">Edit</a>
          </b-table-column>

          <b-table-column label="Delete" centered v-if="can.manage_question_lines" v-slot="props">
            <a href="#" class="button is-danger is-small" @click.prevent="askDeleteQuestionLine(props.row, props.index)">Delete</a>
          </b-table-column>

          <b-table-column label="Ask a question" centered v-slot="props">
            <button
              class="button is-small"
              v-if="can.submit_questions && props.row.status === 'open'"
              @click="openCreateQuestionModal(props.row)">
              Ask a question!
            </button>
            <span v-else-if=" props.row.status !== 'open'">The question line is closed.</span>
            <span v-else>You are not a confirmed participant.</span>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <hr />

        <div class="subtitle" v-if="selectedQuestionLine">Question for selected question line</div>

        <b-table :data.sync="selectedQuestionLine.questions" v-if="selectedQuestionLine" narrowed>
          <b-table-column label="#" v-slot="props">
            {{ props.index + 1 }}
          </b-table-column>

          <b-table-column field="participant" label="Participant" v-slot="props">
            {{ props.row.application.first_name }} {{ props.row.application.last_name }}, {{ props.row.application.body_name }}
          </b-table-column>

          <b-table-column :visible="can.manage_question_lines" field="paricipant_type" label="Participant type" v-slot="props">
            {{ props.row.application.participant_type }}
          </b-table-column>

          <b-table-column field="text" label="Text" v-slot="props">
            {{ props.row.text }}
          </b-table-column>

          <b-table-column field="updated_at" label="Last updated on" v-slot="props">
            {{ props.row.updated_at | datetime }}
          </b-table-column>

          <b-table-column label="" v-slot="props">
            <button
              class="button is-small is-warning"
              v-show="(loginUser.id === props.row.application.user_id && selectedQuestionLine.status === 'open') || can.manage_question_lines"
              @click="openEditQuestionModal(selectedQuestionLine, props.row)">
              Edit
            </button>
          </b-table-column>
          <b-table-column label=" " v-slot="props">
            <button
              class="button is-small is-danger"
              v-show="loginUser.id === props.row.application.id || can.manage_question_lines"
              @click="askDeleteQuestion(selectedQuestionLine, props.row, props.index)">
              Delete
            </button>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import EditQuestionLineModal from './EditQuestionLineModal'
import EditQuestionModal from './EditQuestionModal'

export default {
  name: 'StatutoryQuestionLinesList',
  data () {
    return {
      questionLines: [],
      selected: null,
      event: {},
      selectedQuestionLine: null,
      can: {
        manage_question_lines: false
      },
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    askDeleteQuestionLine (questionLine, index) {
      this.$buefy.dialog.confirm({
        title: 'Deleting a question line',
        message: 'Are you sure you want to <b>delete</b> this question line? This action cannot be undone.',
        confirmText: 'Delete question line',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteQuestionLine(questionLine, index)
      })
    },
    deleteQuestionLine (questionLine, index) {
      this.axios.delete(this.services['statutory'] + '/events/' + this.$route.params.id + '/question-lines/' + questionLine.id).then(() => {
        this.$root.showSuccess('Question line is deleted.')
        this.questionLines.splice(index, 1)
        this.selectedQuestionLine = this.questionLines[index]
      }).catch((err) => this.$root.showError('Could not delete question line', err))
    },
    askDeleteQuestion (questionLine, question, questionIndex) {
      this.$buefy.dialog.confirm({
        title: 'Deleting a question',
        message: 'Are you sure you want to <b>delete</b> this question? This action cannot be undone.',
        confirmText: 'Delete question',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteQuestion(questionLine, question, questionIndex)
      })
    },
    deleteQuestion (questionLine, question, questionIndex) {
      this.axios.delete(this.services['statutory'] + '/events/' + this.$route.params.id + '/question-lines/' + questionLine.id + '/questions/' + question.id).then(() => {
        this.$root.showSuccess('Question is deleted.')
        questionLine.questions.splice(questionIndex, 1)
      }).catch((err) => this.$root.showError('Could not delete question', err))
    },
    openCreateQuestionLineModal () {
      this.$buefy.modal.open({
        component: EditQuestionLineModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          questionLine: {
            name: ''
          },
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openEditQuestionLineModal (questionLine) {
      this.$buefy.modal.open({
        component: EditQuestionLineModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          questionLine,
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openCreateQuestionModal (questionLine) {
      this.$buefy.modal.open({
        component: EditQuestionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          questionLine,
          question: {
            name: ''
          },
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    openEditQuestionModal (questionLine, question) {
      this.$buefy.modal.open({
        component: EditQuestionModal,
        hasModalCard: true,
        props: {
          // When programmatically opening a modal, it doesn't have access to Vue instance
          // and therefore store, services and notifications functions. That's why
          // I'm passing them as props.
          // More info: https://github.com/buefy/buefy/issues/55
          questionLine,
          question,
          event: this.event,
          services: this.services,
          showError: this.$root.showError,
          showSuccess: this.$root.showSuccess,
          router: this.$router
        }
      })
    },
    switchQuestionLineStatus (questionLine) {
      questionLine.isSaving = true
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/question-lines/' + questionLine.id + '/status'

      this.axios.put(url, { status: questionLine.newStatus }).then(() => {
        questionLine.status = questionLine.newStatus
        questionLine.isSaving = false
        this.$root.showSuccess(`Successfully updated status of application for question line "${questionLine.name}" to ${questionLine.status}.`)
      }).catch((err) => {
        questionLine.isSaving = false
        this.$root.showError('Could not update question line status', err)
      })
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions

      return this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/question-lines/')
    }).then((questionLines) => {
      for (const questionLine of questionLines.data.data) {
        questionLine.isSaving = false
        questionLine.newStatus = questionLine.status
      }

      this.questionLines = questionLines.data.data
      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>

<style>
.table-wrapper .table .button:not(.is-primary) {
  color: #000;
}
.table-wrapper .table .is-selected .button, .table-wrapper .table .is-selected .tag {
  border: 1px solid white;
}
</style>
