<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <h2 class="modal-card-title">View candidature</h2>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="tile is-parent is-vertical">
        <article class="tile is-child is-primary">
          <figure class="image">
            <img v-if="!candidate.image" src="/images/logo.png" alt="">
            <img
              v-if="candidate.image"
              :src="services['statutory-static'] + candidate.image.frontend_path"
              :alt="'Photo of ' + candidate.first_name + ' ' + candidate.last_name">
          </figure>
        </article>
      </div>
      <table class="table is-fullwidth">
        <tbody>
          <tr>
            <th scope="row">Position</th>
            <td class="has-text-pre-wrap">{{ position.name }}</td>
          </tr>
          <tr>
            <th scope="row">First name</th>
            <td class="has-text-pre-wrap">{{ candidate.first_name }}</td>
          </tr>
          <tr>
            <th scope="row">Last name</th>
            <td class="has-text-pre-wrap">{{ candidate.last_name }}</td>
          </tr>
          <tr v-if="candidate.notification_email">
            <th scope="row">Email</th>
            <td class="has-text-pre-wrap">{{ candidate.notification_email }}</td>
          </tr>
          <tr>
            <th scope="row">Applied on</th>
            <td class="has-text-pre-wrap">{{ candidate.created_at | datetimeseconds }}</td>
          </tr>
          <tr>
            <th scope="row">Body</th>
            <td class="has-text-pre-wrap">{{ candidate.body_name }}</td>
          </tr>
          <tr>
            <th scope="row">Date of birth</th>
            <td class="has-text-pre-wrap">{{ candidate.date_of_birth }}</td>
          </tr>
          <tr>
            <th scope="row">Member since</th>
            <td class="has-text-pre-wrap">{{ candidate.member_since }}</td>
          </tr>
          <tr>
            <th scope="row">Nationality</th>
            <td class="has-text-pre-wrap">{{ candidate.nationality }}</td>
          </tr>
          <tr>
            <th scope="row">Languages</th>
            <td class="has-text-pre-wrap">{{ candidate.languages.join(', ') }}</td>
          </tr>
          <tr>
            <th scope="row">Studies</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.studies)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Attended Agorae</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_agorae)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Attended EPMs</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_epm)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Attended European Events</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.attended_conferences)" />
            </td>
          </tr>
          <tr>
            <th scope="row">European level experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.european_experience)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Local level experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.local_experience)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Non-AEGEE experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.external_experience)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Position-related experience</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.related_experience)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Motivation</th>
            <td>
              <div class="content" v-html="$options.filters.markdown(candidate.motivation)" />
            </td>
          </tr>
          <tr>
            <th scope="row">Program</th>
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
