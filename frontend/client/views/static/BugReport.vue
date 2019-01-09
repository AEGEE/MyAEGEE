<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <div class="subtitle">Attach screenshot</div>

      <div class="field is-grouped" v-for="(file, index) in files" v-bind:key="index">
        <div class="control">
          <div class="file has-name">
            <label class="file-label">
              <input class="file-input" type="file" name="resume" @change="setFile($event, index)">
              <span class="file-cta">
                <span class="file-icon">
                  <i class="fa fa-upload"></i>
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
          <button class="button is-primary" @click="files.push(null)">Add screenshot</button>
        </div>
      </div>

      <hr />

      <div class="notification is-warning">
        <div class="content">
          <ul>
            <li>Please follow
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/230555649/Submitting+bug+reports" >
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

        <div class="field">
          <label class="label">Your email</label>
          <div class="control">
            <input class="input" type="email" v-model="bug.email" required />
          </div>
        </div>


        <div class="field">
          <div class="control">
            <input type="submit" value="Send bug report" :disabled="isSaving" class="button is-primary is-fullwidth"/>
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
      jiraId: '21430358-44e3-4787-8d72-e23b56714c03',
      files: [null],
      isSaving: false
    }
  },
  methods: {
    setFile (event, index) {
      this.$set(this.files, index, event.target.files[0])
    },
    sendBugReport () {
      for (const file of this.files) {
        if (!file) {
          return this.$root.showDanger('Please select all the files.')
        }
      }

      this.isSaving = true

      const uploadImageUrl = `https://jsd-widget.atlassian.com/api/embeddable/${this.jiraId}/upload`
      const postIssueUrl = `https://jsd-widget.atlassian.com/api/embeddable/${this.jiraId}/request?requestTypeId=5`

      // Using Fetch to not trigger Axios interceptors.
      Promise.all(this.files.map(file => {
        const data = new FormData()
        data.append('file', file)

        return fetch(uploadImageUrl, {
          method: 'POST',
          body: data
        }).then(res => res.json())
      })).then(responses => {
        const attachmentIds = responses.map(response => response[0].temporaryAttachmentId)

        return fetch(postIssueUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: [
              { id: 'summary', value: this.bug.summary },
              { id: 'description', value: this.bug.description },
              { id: 'email', value: this.bug.email },
              { id: 'attachment', value: attachmentIds }
            ]
          })
        })
      }).then((response) => {
        this.isSaving = false

        if (response.status === 200) {
          return this.$root.showSuccess('Your issue is reported.')
        }

        return this.$root.showDanger('There was an error reporting your issue.')
      }).catch((err) => {
        this.isSaving = false
        return this.$root.showDanger('There was an error reporting your issue.')
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {
    if (this.loginUser) {
      this.bug.email = this.loginUser.user.email
    }
  }
}
</script>
