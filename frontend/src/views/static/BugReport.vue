<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div class="subtitle">Attach screenshot</div>
      <div class="notification is-info">
        Attaching a screenshot is not mandatory, but it will help us with reproducing the bug.
        If you do not attach a screenshot, do click the 'Remove screenshot' button before submitting.
        You can attach up to {{ maxFiles }} screenshots of at most {{ maxFileSize / 1024 / 1024 }} MB each.
      </div>

      <div class="field is-grouped" v-for="(file, index) in files" v-bind:key="index">
        <div class="control">
          <div class="file has-name">
            <label class="file-label">
              <input class="file-input" type="file" name="resume" @change="setFile($event, index)">
              <span class="file-cta">
                <span class="file-icon">
                  <font-awesome-icon icon="upload" />
                </span>
                <span class="file-label">
                  Choose a file
                </span>
              </span>
              <span class="file-name">
                {{ file ? file.name : 'Not set.' }}
              </span>
            </label>
          </div>
        </div>
        <div class="control">
          <button class="button is-danger" @click="files.splice(index, 1)">Remove screenshot</button>
        </div>
      </div>

      <div class="field">
        <div class="control">
          <button class="button is-primary" :disabled="files.length >= maxFiles" @click="files.push(null)">Add screenshot</button>
        </div>
      </div>

      <hr />

      <div class="notification is-warning">
        <div class="content">
          <ul>
            <li>Please follow
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/230555649/Submitting+bug+reports">
                this guide on submitting bug reports.
              </a>
            </li>
            <li>We can (and we most likely will) contact you for more details, please answer it with email, otherwise we won't be able to get more information from you and will close your ticket.</li>
          </ul>
        </div>
      </div>

      <form @submit.prevent="sendBugReport()">
        <div class="field">
          <label class="label">What is happening?</label>
          <div class="control">
            <input class="input" type="text" v-model="bug.summary" required />
          </div>
        </div>

        <div class="field">
          <label class="label">Describe what's wrong and how it should work</label>
          <div class="control">
            <textarea class="textarea" v-model="bug.description" required />
          </div>
        </div>

        <div class="field" v-if="!loginUser">
          <label class="label">Your email</label>
          <div class="control">
            <input class="input" type="email" v-model="bug.email" required />
          </div>
        </div>

        <div class="field">
          <div class="control">
            <input type="submit" value="Send bug report" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BugReport',
  data () {
    return {
      bug: {
        summary: '',
        description: '',
        email: ''
      },
      files: [null],
      // Should be the same as the bug_report limits in core's config.
      maxFiles: 3,
      maxFileSize: 5 * 1024 * 1024,
      isSaving: false
    }
  },
  methods: {
    setFile (event, index) {
      const file = event.target.files[0]
      if (file && file.size > this.maxFileSize) {
        event.target.value = ''
        this.$set(this.files, index, null)
        return this.$root.showError(`The screenshot should be at most ${this.maxFileSize / 1024 / 1024} MB.`)
      }

      this.$set(this.files, index, file)
    },
    sendBugReport () {
      if (this.files.length > this.maxFiles) {
        return this.$root.showError(`You can attach at most ${this.maxFiles} screenshots.`)
      }

      for (const file of this.files) {
        if (!file) {
          return this.$root.showError('Please select all the files.')
        }
      }

      this.isSaving = true

      const data = new FormData()
      data.append('summary', this.bug.summary)
      data.append('description', this.bug.description)
      data.append('email', this.bug.email || '')
      for (const file of this.files) {
        data.append('screenshots', file)
      }

      // Sent through core, so it's logged on our side and not blocked by browser extensions.
      this.axios.post(this.services['core'] + '/bug-report', data).then(() => {
        this.isSaving = false
        this.$root.showSuccess('Your issue is reported.')
      }).catch((err) => {
        this.isSaving = false
        this.$root.showError('There was an error reporting your issue', err)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    if (this.loginUser) {
      this.bug.email = this.loginUser.notification_email
    }
  }
}
</script>
