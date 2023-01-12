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
          <td><b>Gender</b></td>
          <td v-show="participant.gender">{{ participant.gender }}</td>
          <td v-show="!participant.gender">Unknown</td>
        </tr>

        <tr>
          <td><b>Date of birth</b></td>
          <td v-show="participant.date_of_birth">{{ participant.date_of_birth | date }}</td>
          <td v-show="!participant.date_of_birth">Unknown</td>
        </tr>

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
          <td><b>Email address</b></td>
          <td>{{ participant.notification_email }}</td>
        </tr>

        <tr>
          <td><b>Visa required?</b></td>
          <td>{{ participant.visa_required | beautify }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa passport number</b></td>
          <td>{{ participant.visa_passport_number }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa passport issue date</b></td>
          <td>{{ participant.visa_passport_issue_date }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa passport expiration date</b></td>
          <td>{{ participant.visa_passport_expiration_date }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa passport issue authority</b></td>
          <td>{{ participant.visa_passport_issue_authority }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa place of birth</b></td>
          <td>{{ participant.visa_place_of_birth }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa embassy</b></td>
          <td>{{ participant.visa_embassy }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa street and house number</b></td>
          <td>{{ participant.visa_street_and_house }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa postal code</b></td>
          <td>{{ participant.visa_postal_code }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa city</b></td>
          <td>{{ participant.visa_city }}</td>
        </tr>

        <tr v-show="participant.visa_required === true && participant.status === 'accepted'">
          <td><b>Visa country</b></td>
          <td>{{ participant.visa_country }}</td>
        </tr>

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
