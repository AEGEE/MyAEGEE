<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">View participant</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
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
          <td><b>Email</b></td>
          <td>{{ participant.notification_email }}</td>
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
    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'ViewParticipantModel',
  props: ['participant', 'event'],
  data () {
    return {}
  }
}
</script>
