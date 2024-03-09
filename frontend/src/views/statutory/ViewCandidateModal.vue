<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">View candidature</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!candidate.image" src="/images/logo.png">
            <img v-if="candidate.image" :src="services['statutory-static'] + candidate.image.frontend_path">
          </figure>
        </article>
      </div>
      <table class="table is-fullwidth">
        <tbody>
          <tr>
            <th>Position</th>
            <td class="has-text-pre-wrap">{{ position.name }}</td>
          </tr>
          <tr>
            <th>First name</th>
            <td class="has-text-pre-wrap">{{ candidate.first_name }}</td>
          </tr>
          <tr>
            <th>Last name</th>
            <td class="has-text-pre-wrap">{{ candidate.last_name }}</td>
          </tr>
          <tr v-if="candidate.notification_email">
            <th>Email</th>
            <td class="has-text-pre-wrap">{{ candidate.notification_email }}</td>
          </tr>
          <tr>
            <th>Applied on</th>
            <td class="has-text-pre-wrap">{{ candidate.created_at | datetimeseconds }}</td>
          </tr>
          <tr>
            <th>Body</th>
            <td class="has-text-pre-wrap">{{ candidate.body_name }}</td>
          </tr>
          <tr>
            <th>Date of birth</th>
            <td class="has-text-pre-wrap">{{ candidate.date_of_birth }}</td>
          </tr>
          <tr>
            <th>Member since</th>
            <td class="has-text-pre-wrap">{{ candidate.member_since }}</td>
          </tr>
          <tr>
            <th>Nationality</th>
            <td class="has-text-pre-wrap">{{ candidate.nationality }}</td>
          </tr>
          <tr>
            <th>Languages</th>
            <td class="has-text-pre-wrap">{{ candidate.languages.join(', ') }}</td>
          </tr>
          <tr>
            <th>Studies</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.studies)" />
            </td>
          </tr>
          <tr>
            <th>Attended Agorae</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_agorae)" />
            </td>
          </tr>
          <tr>
            <th>Attended EPMs</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_epm)" />
            </td>
          </tr>
          <tr>
            <th>Attended AEGEE conferences</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_conferences)" />
            </td>
          </tr>
          <tr>
            <th>European level experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.european_experience)" />
            </td>
          </tr>
          <tr>
            <th>Local level experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.local_experience)" />
            </td>
          </tr>
          <tr>
            <th>Non-AEGEE experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.external_experience)" />
            </td>
          </tr>
          <tr>
            <th>Position-related experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.related_experience)" />
            </td>
          </tr>
          <tr>
            <th>Motivation</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.motivation)" />
            </td>
          </tr>
          <tr>
            <th>Program</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.program)" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'ViewCandidateModal',
  props: ['event', 'position', 'candidate', 'services'],
  data () {
    return {}
  }
}
</script>
