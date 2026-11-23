<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Change picture</p>
      <button type="button" class="delete" aria-label="Close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <div class="field is-grouped">
        <div class="control">
          <div class="file has-name">
            <label class="file-label">
              <input class="file-input" type="file" name="head_image" aria-label="Choose a picture" @change="setFile($event)">
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
          <button type="button" class="button is-info" :disabled="!file" @click="updateImage()">Upload</button>
        </div>

        <div class="control">
          <button type="button" class="button is-danger" :disabled="!user.image" @click="removeImage()">Delete</button>
        </div>
      </div>
    </section>

    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'PictureModal',
  props: ['user', 'permissions', 'services', 'showError', 'showSuccess', 'router'],
  data () {
    return {
      file: null
    }
  },
  methods: {
    setFile (event) {
      this.file = event.target.files[0]
    },
    updateImage () {
      if (!this.file) return

      const data = new FormData()
      data.append('head_image', this.file)

      this.axios.post(this.services['core'] + '/members/' + this.user.id + '/upload', data).then(() => {
        this.showSuccess('User image is updated.')
        this.router.go(0)
      }).catch((err) => {
        this.showError('Could not update image', err)
      })
    },
    removeImage () {
      if (!this.user.image) return

      this.axios.delete(this.services['core'] + '/members/' + this.user.id + '/image').then(() => {
        this.showSuccess('User image is removed.')
        this.router.go(0)
      }).catch((err) => {
        this.showError('Could not remove image', err)
      })
    }
  }
}
</script>
