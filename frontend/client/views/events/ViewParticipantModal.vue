<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">View participant</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <table class="table is-narrow is-fullwidth">
        <tr>
          <td><b>First Name</b></td>
          <td>{{ participant.first_name }}</td>
        </tr>

        <tr>
          <td><b>Last Name</b></td>
          <td>{{ participant.last_name }}</td>
        </tr>

        <tr>
          <td><b>Body</b></td>
          <td>{{ participant.body_name }}</td>
        </tr>

        <tr>
          <td><b>Application date</b></td>
          <td>{{ participant.created_at | date }}</td>
        </tr>

        <tr v-for="(field, index) in event.questions" v-bind:key="index">
          <td><b>{{ field.description }}</b></td>
          <td>{{ participant.answers[index] | beautify }}</td>
        </tr>

        <tr>
          <td><b>Board comment</b></td>
          <td v-show="participant.board_comment">{{ participant.board_comment }}</td>
          <td v-show="!participant.board_comment">-</td>
        </tr>
      </table>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-danger" @click="changeState('rejected')">
        <span class="icon">
          <i class="fa fa-minus-circle"></i>
        </span>
        <span>Reject</span>
      </button>
      <button class="button is-primary" @click="changeState('accepted')">
        <span class="icon">
          <i class="fa fa-plus-circle"></i>
        </span>
        <span>Accept</span>
      </button>
      <button class="button" @click="changeState('pending')">
        <span class="icon">
          <i class="fa fa-circle-notch"></i>
        </span>
        <span>Postpone</span>
      </button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'ViewParticipantModel',
  props: ['participant', 'event', 'services', 'showSuccess', 'showDanger', 'route'],
  data () {
    return {}
  },
  methods: {
    changeState (newState) {
      // Store the change
      this.axios.put(this.services['oms-events'] + '/single/' + this.event.id + '/applications/' + this.participant.id + '/status/', {
        status: newState
      }).then(() => {
        this.participant.status = newState

        this.showSuccess('Participant status is updated.')
        this.$parent.close()
      }).catch((err) => {
        this.showDanger('Could not update participant status: ' + err.message)
      })
    }
  },
  mounted () {

  }
}
</script>