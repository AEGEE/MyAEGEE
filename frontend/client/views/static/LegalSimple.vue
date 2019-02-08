<template>
  <div class="tile is-ancestor legal">
    <div class="tile is-parent is-vertical">
      <div class="tile is-child">
        <div class="content">
          <div class="title">Which information about you we are storing and processing?</div>

          <div class="subtitle">Information related to users</div>

          <strong>AEGEE-Europe stores this information about you:</strong>
          <ul>
            <li>Your full name and surname</li>
            <li>Your email address</li>
            <li>Your address</li>
            <li>Your phone</li>
            <li>Your date of birth</li>
            <li>Your gender</li>
            <li>Your profile picture</li>
            <li>List of bodies you've joined or requested to join</li>
            <li>List of circles you're a member of</li>
          </ul>

          <p>This information is stored <strong>permanently</strong> until you (or person who has rights in the system) delete your profile from the system.</p>
          <p>You can delete your profile at any given point.</p>

          <strong>This information is stored permanently:</strong>

          <ul>
            <li>List of events you've applied to and your application</li>
          </ul>

          <strong>Also we share this information with this services:</strong>

          <ul>
            <li><a href="https://podio.com/">Podio</a> - for managing surveys and other stuff</li>
            <li><a href="https://ru.atlassian.com/">Atlassian</a> - for internal bug fixing using JIRA</li>
            <li><a href="https://www.google.com/">Google</a> - for providing GSuite accounts</li>
            <li><a href="https://www.microsoft.com/">Microsoft</a></li>
          </ul>

          <!--<p>To get full info, please visit <router-link :to="{ name: 'oms.legal.full' }">this page</router-link>.</p>-->
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.legal ul li {
  list-style-type: disc;
  margin-left: 25px;
}

.legal div, .legal p {
  margin-bottom: 10px;
}
</style>
