<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">View candidature</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image is-1by1">
            <img src="/images/logo.png">
          </figure>
        </article>
      </div>
      <table class="table is-fullwidth">
        <tbody>
          <tr>
            <th>Position</th>
            <td>{{ position.name }}</td>
          </tr>
          <tr>
            <th>First name</th>
            <td>{{ candidate.first_name }}</td>
          </tr>
          <tr>
            <th>Last name</th>
            <td>{{ candidate.last_name }}</td>
          </tr>
          <tr>
            <th>Body</th>
            <td>{{ candidate.body_name }}</td>
          </tr>
          <tr>
            <th>Date of birth</th>
            <td>{{ candidate.date_of_birth }}</td>
          </tr>
          <tr>
            <th>Gender</th>
            <td>{{ candidate.gender }}</td>
          </tr>
          <tr>
            <th>Nationality</th>
            <td>{{ candidate.nationality }}</td>
          </tr>
          <tr>
            <th>Member since</th>
            <td>{{ candidate.member_since }}</td>
          </tr>
          <tr>
            <th>Languages</th>
            <td>{{ candidate.languages.join(', ') }}</td>
          </tr>
          <tr>
            <th>Studies</th>
            <td>{{ candidate.studies }}</td>
          </tr>
          <tr>
            <th>European level experience</th>
            <td>{{ candidate.european_experience }}</td>
          </tr>
          <tr>
            <th>Local level experience</th>
            <td>{{ candidate.local_experience }}</td>
          </tr>
          <tr>
            <th>Attended Agorae</th>
            <td>{{ candidate.attended_agorae }}</td>
          </tr>
          <tr>
            <th>Attended EPMs</th>
            <td>{{ candidate.attended_epm }}</td>
          </tr>
          <tr>
            <th>Attended AEGEE conferences</th>
            <td>{{ candidate.attended_conferences }}</td>
          </tr>
          <tr>
            <th>Non-AEGEE experience</th>
            <td>{{ candidate.external_experience }}</td>
          </tr>
          <tr>
            <th>Position-related experience</th>
            <td>{{ candidate.related_experience }}</td>
          </tr>
          <tr>
            <th>Motivation</th>
            <td>{{ candidate.motivation }}</td>
          </tr>
          <tr>
            <th>Program</th>
            <td>{{ candidate.program }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <footer class="modal-card-foot">
    </footer>
  </div>
</template>

<script>
export default {
  name: 'ViewCandidateModal',
  props: ['event', 'position', 'candidate'],
  data () {
    return {}
  }
}
</script>