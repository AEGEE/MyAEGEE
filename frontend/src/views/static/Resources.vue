<template>
  <div class="resources">
    <section
      v-for="section in sections"
      :key="section.id"
      class="resources-section"
      :class="'is-' + section.theme"
      :aria-labelledby="'resources-' + section.id"
    >
      <h2 :id="'resources-' + section.id" class="resources-section-title">{{ section.name }}</h2>

      <ul class="resources-grid">
        <li v-for="link in section.links" :key="link.title">
          <!-- Pages inside MyAEGEE open in the same tab; other sites in a new one. -->
          <component :is="link.to ? 'router-link' : 'a'" class="resource-card" v-bind="linkAttrs(link)">
            <span class="resource-card-header">
              <span class="resource-card-title">{{ link.title }}</span>
              <svg v-if="!link.to" class="resource-card-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                <path d="M5 2H2v10h10V9M8 2h4v4M12 2L6.5 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="resource-card-body">{{ link.description }}</span>
            <span v-if="!link.to" class="is-sr-only">(opens in a new tab)</span>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
// Sections are grouped by what members want to do. Each section has a theme: the card
// header is a solid VI colour, with white text on blue, blue dark, purple, red and
// grey dark, and grey dark text on yellow and green light.
export default {
  data () {
    return {
      sections: [
        {
          id: 'informed',
          name: 'Stay informed',
          theme: 'blue',
          links: [
            { url: 'https://aegee.org', title: 'AEGEE Website', description: 'Official website' },
            {
              url: 'https://b1905f52.sibforms.com/serve/MUIFABZ7dW0Hjpw5BjnfaUUf6FWO5WAeoUit48zO0eIA0YAnT6pErXmLyKqTMrfjXDeTMd62E75ggVEsalSQtxGIpUjI2sO3gdjeO8pn-LRorgvcwJIyJNPYLq0HyxqRmpu3UtQaySzFxxaDXtr2cNwJiiXW-jafJVI90kqeUa0vh4t2n-SJTKx8BSoKqcNVLE_UOIO7ch1PAfVhXA==',
              title: 'Internal Newsletter',
              description: 'Monthly internal newsletter, for all our members.'
            },
            { url: 'https://www.zeus.aegee.org/magazine/', title: 'The AEGEEan Magazine', description: 'AEGEE\'s online magazine' },
            { url: 'https://drive.google.com/drive/folders/1kU6DQd0v5rsGMwdjnhYUerYcJMH7af0_', title: 'Key to Europe', description: 'Yearbook: the annual report publication' },
            { to: { name: 'oms.confluence', params: { page_id: 'mailing-lists' } }, title: 'Mailing Lists', description: 'AEGEE mailing lists' },
            { url: 'https://www.facebook.com/groups/aegeeans/', title: 'Facebook Group', description: 'AEGEE\'s official group on Facebook' }
          ]
        },
        {
          id: 'safety',
          name: 'Safety and conduct',
          theme: 'purple',
          links: [
            { url: 'https://www.aegee.org/code-of-conduct/', title: 'Code of Conduct', description: 'Read AEGEE\'s Code of Conduct' },
            {
              url: 'https://docs.google.com/forms/d/e/1FAIpQLSf0OmluW11nce72VEuWOybQ1n83gMK6UcE9QvfJ5gIBETUwpA/viewform',
              title: 'Code of Conduct Violation Report',
              description: 'Report a case of Code of Conduct violation'
            },
            { url: 'https://forms.gle/EcaDkdyQfSb65Jdh8', title: 'Safe Person Committee', description: 'Request a Safe Person or workshop for your event' }
          ]
        },
        {
          id: 'statutory',
          name: 'Statutory and strategy',
          theme: 'yellow',
          links: [
            { url: 'https://www.zeus.aegee.org/statutoryvote/jc/', title: 'Online Voting', description: 'Online voting for Agorae and the General Assembly' },
            { url: 'https://drive.google.com/drive/folders/1GKd6jWeolMDRw7EXZO-ROXupBQUzAgk2', title: 'CIA', description: 'Statutes, regulations, working formats and motions' },
            { url: 'https://drive.google.com/drive/folders/1TSLKDPKUFe7k3POjlW1XzJdxgz5mfhrQ', title: 'Strategic Plans & Action Agendas', description: 'Strategic Plans and their Action Agendas' }
          ]
        },
        {
          id: 'network',
          name: 'Network',
          theme: 'green',
          links: [
            {
              url: 'https://docs.google.com/forms/d/e/1FAIpQLSd2u-r1jFGyNwYCwsSnMf9-dApH7ZGeGltZusxqWqkB_VQ0zg/viewform',
              title: 'AEGEE Contact in your City',
              description: 'Leave your details to start founding an AEGEE Contact in your city'
            },
            {
              url: 'https://docs.google.com/forms/d/e/1FAIpQLSfmbGAjG_us00KMuV-pMeasja_gfjLXVwhaqRK9y5rbTSb0xw/viewform',
              title: 'Suggest a City for a Contact',
              description: 'Suggest where AEGEE should have a Contact'
            },
            { url: 'https://docs.google.com/document/d/1rQRddt8H3J1RUYMpdxRxuhNqyV3BcP8mV8ykNLNup3o/edit', title: 'Set up your own Contact', description: 'Find out how to set up a Contact in this step-by-step guide' },
            { url: 'https://docs.google.com/document/d/1e0jdTLvn7-JdwOlxMXcf55I5mcNwEmI_loN0djj0U2c/edit', title: 'Develop your Contact', description: 'Tips and tricks to develop your Contact, in one toolkit' }
          ]
        },
        {
          id: 'financial',
          name: 'Financial',
          theme: 'blue-dark',
          links: [
            { url: 'https://form.jotform.com/261133028599056', title: 'ASRF Application Form', description: 'Apply for the AEGEE Social Responsibility Fund' },
            { url: 'https://form.jotform.com/92653241656965', title: 'Reimbursement Form', description: 'Request a reimbursement for AEGEE-Europe\'s expenses' },
            { url: 'https://form.jotform.com/261146144461047', title: 'Travel Plan of European Bodies', description: 'Request travel plan approval on behalf of your European Body' }
          ]
        },
        {
          id: 'requests',
          name: 'Requests',
          theme: 'red',
          links: [
            { url: 'https://forms.gle/DhfVStza9xhn1jRT6', title: 'AEGEE-Academy', description: 'Request a trainer for your training events' },
            { url: 'https://forms.gle/s8vE6b9wrEHqV1xe9', title: 'AEGEE House Guest Request', description: 'Visiting the AEGEE house' }
          ]
        },
        {
          id: 'brand',
          name: 'Brand and PR',
          theme: 'grey',
          links: [
            { url: 'https://myaegee.atlassian.net/wiki/spaces/KMS/pages/2238152708/Public+Relations', title: 'Visual Identity', description: 'Manual, logos, PR materials and more' }
          ]
        }
      ]
    }
  },
  methods: {
    linkAttrs (link) {
      if (link.to) return { to: link.to }
      return { href: link.url, target: '_blank', rel: 'noopener noreferrer' }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '~bulma/sass/utilities/mixins';

// VI 2.0 values (see styles/main.scss).
$blue-standard: #1468c5;
$blue-dark: #163e7a;
$red-standard: #c51c13;
$green-light: #c2de5d;
$purple-standard: #931991;
$yellow-standard: #fbba00;
$grey-dark: #434242;
$grey-background: #ebecec;
$white: #ffffff;

// name, header fill, header text
$themes: (
  ('blue', $blue-standard, $white),         // 5.50:1
  ('blue-dark', $blue-dark, $white),        // 10.48:1
  ('purple', $purple-standard, $white),     // 7.53:1
  ('red', $red-standard, $white),           // 5.92:1
  ('grey', $grey-dark, $white),             // 10.02:1
  ('yellow', $yellow-standard, $grey-dark), // 5.78:1
  ('green', $green-light, $grey-dark)       // 6.63:1
);

.resources {
  display: flex;
  flex-direction: column;
  gap: 40px;
  color: $grey-dark;
}

.resources-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resources-section-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 28px;
  color: $grey-dark;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
}

.resource-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: $white;
  border: 1px solid $grey-background;
  border-radius: 12px;
  color: $grey-dark;
  text-decoration: none;

  // Keyboard focus uses the browser's focus ring, which follows the 12px radius.

  &:hover .resource-card-body {
    background: $grey-background; // 8.46:1 with grey dark text
  }

  &:hover .resource-card-title {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}

.resource-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 68px;
  padding: 14px 16px;

  // One card per row on phones: no need to equalise heights.
  @include mobile {
    min-height: 0;
  }
}

.resource-card-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
}

.resource-card-icon {
  flex-shrink: 0;
}

.resource-card-body {
  flex-grow: 1;
  min-height: 78px;
  padding: 14px 16px 18px;
  font-size: 14px;
  line-height: 21px;

  @include mobile {
    min-height: 0;
  }
}

@each $name, $fill, $text in $themes {
  .resources-section.is-#{$name} .resource-card-header {
    background: $fill;
    color: $text;
  }
}
</style>
