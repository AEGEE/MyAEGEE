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

        <!-- <tr>
          <td><b>Gender</b></td>
          <td>{{ participant.gender }}</td>
        </tr>

        <tr>
          <td><b>Date of birth</b></td>
          <td>{{ participant.date_of_birth | date }}</td>
        </tr> -->

        <tr>
          <td><b>Nationality</b></td>
          <td>{{ participant.nationality }}</td>
        </tr>

        <tr>
          <td><b>Body</b></td>
          <td>{{ participant.body_name }}</td>
        </tr>

        <tr>
          <td><b>Travelling from</b></td>
          <td>{{ participant.travelling_from }}</td>
        </tr>

        <tr>
          <td><b>Application date</b></td>
          <td>{{ participant.created_at | date }}</td>
        </tr>

        <tr>
          <td><b>Visa required?</b></td>
          <td>{{ participant.visa_required | beautify }}</td>
        </tr>

        <!-- TODO: add visa fields shown when application is status x (discuss with SUCT) -->

        <tr>
          <td><b>Meals type</b></td>
          <td>{{ participant.meals }}</td>
        </tr>

        <tr>
          <td><b>Allergies</b></td>
          <td v-show="participant.allergies">{{ participant.allergies }}</td>
          <td v-show="!participant.allergies">-</td>
        </tr>

        <tr>
          <td><b>AEGEE experience</b></td>
          <td>{{ participant.aegee_experience }}</td>
        </tr>

        <tr>
          <td><b>Ideal SU</b></td>
          <td>{{ participant.ideal_su }}</td>
        </tr>

        <tr>
          <td><b>Motivation</b></td>
          <td>{{ participant.motivation }}</td>
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

    </footer>
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
