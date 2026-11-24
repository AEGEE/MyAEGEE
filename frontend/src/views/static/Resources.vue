<template>
  <div class="resources" role="region" aria-label="Resources" :aria-busy="isLoading">
    <div v-if="canManage" class="resources-actions">
      <router-link class="button is-primary" :to="{ name: 'oms.resources.manage' }">Manage resources</router-link>
    </div>

    <b-loading :is-full-page="false" :active="isLoading" />

    <empty-table-stub v-if="!isLoading && sections.length === 0" />

    <section
      v-for="section in sections"
      :key="section.id"
      class="resources-section"
      :aria-labelledby="'resources-' + section.id"
    >
      <h2 :id="'resources-' + section.id" class="resources-section-title">{{ section.name }}</h2>

      <ul class="resources-grid">
        <li v-for="link in section.links" :key="link.id">
          <!-- Pages inside MyAEGEE open in the same tab; other sites in a new one. -->
          <component :is="isInternal(link.url) ? 'router-link' : 'a'" class="resource-card" v-bind="linkAttrs(link)">
            <span class="resource-card-header" :style="themeStyle(section.theme)">
              <span class="resource-card-title">{{ link.title }}</span>
              <svg v-if="!isInternal(link.url)" class="resource-card-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                <path d="M5 2H2v10h10V9M8 2h4v4M12 2L6.5 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="resource-card-body">{{ link.description }}</span>
            <span v-if="!isInternal(link.url)" class="is-sr-only">(opens in a new tab)</span>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { themeStyle, isInternal, canManageResources } from '../resources/helpers'

export default {
  name: 'Resources',
  data () {
    return {
      sections: [],
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services', 'permissions']),
    canManage () {
      return canManageResources(this.permissions)
    }
  },
  methods: {
    themeStyle,
    isInternal,
    linkAttrs (link) {
      if (isInternal(link.url)) return { to: link.url }
      return { href: link.url, target: '_blank', rel: 'noopener noreferrer' }
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['core'] + '/resources').then((response) => {
      this.sections = response.data.data
    }).catch((err) => {
      this.$root.showError('Could not load the resources', err)
    }).finally(() => {
      this.isLoading = false
    })
  }
}
</script>

<style lang="scss" scoped>
@import '~bulma/sass/utilities/mixins';

// VI 2.0 values (see styles/main.scss).
$grey-dark: #434242;
$grey-background: #ebecec;
$white: #ffffff;

.resources {
  position: relative; // for the loading overlay
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

.resources-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
