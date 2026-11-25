<template>
  <div class="manage-resources" role="region" aria-labelledby="manage-resources-title" :aria-busy="isLoading || isSaving">
    <div class="manage-header">
      <h1 id="manage-resources-title" class="title">Manage resources</h1>
      <div class="buttons">
        <router-link class="button" :to="{ name: 'oms.resources' }">View the Resources page</router-link>
        <router-link v-if="canManage" class="button is-primary" :to="{ name: 'oms.resources.categories.create' }">Add section</router-link>
      </div>
    </div>

    <div v-if="!canManage" class="notification is-warning">
      You need the <code>global:manage:resources</code> permission to change the Resources page.
    </div>
    <p v-else class="manage-intro">Changes show on the Resources page straight away. A section can only be deleted once it has no links.</p>

    <b-loading :is-full-page="false" :active="isLoading" />

    <empty-table-stub v-if="!isLoading && sections.length === 0" />

    <section
      v-for="(section, sectionIndex) in sections"
      :key="section.id"
      class="box manage-section"
      :aria-labelledby="'manage-section-' + section.id"
    >
      <div class="manage-section-header">
        <div class="manage-section-name">
          <span class="theme-swatch" :style="themeStyle(section.theme)" aria-hidden="true" />
          <h2 :id="'manage-section-' + section.id" class="subtitle manage-section-title">{{ section.name }}</h2>
        </div>

        <div v-if="canManage" class="buttons manage-section-actions">
          <button
            type="button"
            class="button is-small"
            :ref="'move-section-' + section.id + '-up'"
            :disabled="isSaving || sectionIndex === 0"
            :aria-label="'Move section ' + section.name + ' up'"
            @click="moveSection(sectionIndex, -1)"
          >
            <font-awesome-icon icon="arrow-up" />
          </button>
          <button
            type="button"
            class="button is-small"
            :ref="'move-section-' + section.id + '-down'"
            :disabled="isSaving || sectionIndex === sections.length - 1"
            :aria-label="'Move section ' + section.name + ' down'"
            @click="moveSection(sectionIndex, 1)"
          >
            <font-awesome-icon icon="arrow-down" />
          </button>
          <router-link
            class="button is-small is-warning"
            :to="{ name: 'oms.resources.categories.edit', params: { id: section.id } }"
            :aria-label="'Edit section ' + section.name"
          >
            Edit
          </router-link>
          <button
            type="button"
            class="button is-small is-danger"
            :disabled="isSaving || section.links.length > 0"
            :title="section.links.length > 0 ? 'Move or delete its links first' : ''"
            :aria-label="'Delete section ' + section.name"
            @click="askDeleteSection(section)"
          >
            Delete
          </button>
        </div>
      </div>

      <ul v-if="section.links.length > 0" class="manage-links">
        <li v-for="(link, linkIndex) in section.links" :key="link.id" class="manage-link">
          <div class="manage-link-text">
            <strong>{{ link.title }}</strong>
            <span>{{ link.description }}</span>
            <span class="manage-link-url">
              <span v-if="isInternal(link.url)" class="tag is-info is-light">MyAEGEE</span>
              {{ link.url }}
            </span>
          </div>

          <div v-if="canManage" class="buttons manage-link-actions">
            <button
              type="button"
              class="button is-small"
              :ref="'move-link-' + link.id + '-up'"
              :disabled="isSaving || linkIndex === 0"
              :aria-label="'Move link ' + link.title + ' up'"
              @click="moveLink(section, linkIndex, -1)"
            >
              <font-awesome-icon icon="arrow-up" />
            </button>
            <button
              type="button"
              class="button is-small"
              :ref="'move-link-' + link.id + '-down'"
              :disabled="isSaving || linkIndex === section.links.length - 1"
              :aria-label="'Move link ' + link.title + ' down'"
              @click="moveLink(section, linkIndex, 1)"
            >
              <font-awesome-icon icon="arrow-down" />
            </button>
            <router-link
              class="button is-small is-warning"
              :to="{ name: 'oms.resources.links.edit', params: { id: link.id } }"
              :aria-label="'Edit link ' + link.title"
            >
              Edit
            </router-link>
            <button
              type="button"
              class="button is-small is-danger"
              :disabled="isSaving"
              :aria-label="'Delete link ' + link.title"
              @click="askDeleteLink(section, link)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>

      <p v-else class="manage-no-links">This section has no links yet.</p>

      <router-link
        v-if="canManage"
        class="button is-small is-primary is-outlined"
        :to="{ name: 'oms.resources.links.create', query: { category_id: section.id } }"
        :aria-label="'Add link to ' + section.name"
      >
        Add link
      </router-link>
    </section>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { themeStyle, isInternal, canManageResources } from './helpers'

function swappedIds (items, index, direction) {
  const ids = items.map(item => item.id)
  const other = index + direction;
  [ids[index], ids[other]] = [ids[other], ids[index]]
  return ids
}

export default {
  name: 'ManageResources',
  data () {
    return {
      sections: [],
      isLoading: false,
      isSaving: false
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
    fetchData () {
      this.isLoading = true
      return this.axios.get(this.services['core'] + '/resources').then((response) => {
        this.sections = response.data.data
      }).catch((err) => {
        this.$root.showError('Could not load the resources', err)
      }).finally(() => {
        this.isLoading = false
      })
    },
    // Refetches also on failure: someone else may have changed the page.
    save (request, successMessage, errorMessage) {
      this.isSaving = true
      return request().then(() => {
        if (successMessage) this.$root.showSuccess(successMessage)
      }).catch((err) => {
        this.$root.showError(errorMessage, err)
      })
        .then(() => this.fetchData())
        .finally(() => {
          this.isSaving = false
        })
    },
    // The buttons are off while a move is saved, which takes the focus away from the one that
    // was pressed. Once they are on again, it goes back to that button, or to the other one of
    // the same item when the item can't move further that way.
    focusMoveButton (item, direction) {
      const pressed = this.$refs[item + (direction < 0 ? '-up' : '-down')]
      const other = this.$refs[item + (direction < 0 ? '-down' : '-up')]
      const button = [].concat(pressed, other).find(candidate => candidate && !candidate.disabled)
      if (button) button.focus()
    },
    moveSection (index, direction) {
      const section = this.sections[index]
      const ids = swappedIds(this.sections, index, direction)
      return this.save(
        () => this.axios.put(this.services['core'] + '/resources/categories/order', { ids }),
        null,
        'Could not move the section'
      ).then(() => this.$nextTick()).then(() => this.focusMoveButton('move-section-' + section.id, direction))
    },
    moveLink (section, index, direction) {
      const link = section.links[index]
      const ids = swappedIds(section.links, index, direction)
      return this.save(
        () => this.axios.put(this.services['core'] + '/resources/categories/' + section.id + '/links/order', { ids }),
        null,
        'Could not move the link'
      ).then(() => this.$nextTick()).then(() => this.focusMoveButton('move-link-' + link.id, direction))
    },
    askDeleteSection (section) {
      this.$buefy.dialog.confirm({
        title: 'Delete a section',
        message: 'Are you sure you want to <b>delete</b> this section? This action cannot be undone.',
        confirmText: 'Delete section',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.save(
          () => this.axios.delete(this.services['core'] + '/resources/categories/' + section.id),
          'Section is deleted.',
          'Could not delete the section'
        )
      })
    },
    askDeleteLink (section, link) {
      this.$buefy.dialog.confirm({
        title: 'Delete a link',
        message: 'Are you sure you want to <b>delete</b> this link? This action cannot be undone.',
        confirmText: 'Delete link',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.save(
          () => this.axios.delete(this.services['core'] + '/resources/links/' + link.id),
          'Link is deleted.',
          'Could not delete the link'
        )
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>

<style lang="scss" scoped>
@import '~bulma/sass/utilities/mixins';

$grey-background: #ebecec;

.manage-resources {
  position: relative; // for the loading overlay
}

.manage-header,
.manage-section-header,
.manage-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.manage-header {
  margin-bottom: 12px;

  .title {
    margin-bottom: 0;
  }
}

.manage-intro {
  margin-bottom: 20px;
}

.manage-section-header {
  margin-bottom: 12px;
}

.manage-section-name {
  display: flex;
  align-items: center;
  min-width: 0;
}

.manage-section-title {
  margin-bottom: 0;
  overflow-wrap: anywhere;
}

.theme-swatch {
  display: inline-block;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border-radius: 4px;
}

.buttons {
  margin-bottom: 0;

  .button {
    margin-bottom: 0;
  }
}

.manage-links {
  margin-bottom: 16px;
}

.manage-link {
  padding: 10px 0;
  border-top: 1px solid $grey-background;
}

.manage-link-text {
  display: flex;
  flex: 1 1 320px;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.manage-link-url,
.manage-no-links {
  color: #6b6b6b; // 5.34:1 on white
}

.manage-link-url {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.manage-link-actions {
  flex-wrap: nowrap;

  @include mobile {
    flex-wrap: wrap;
  }
}
</style>
