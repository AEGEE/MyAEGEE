<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Change picture</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <div class="field is-grouped">
        <div class="control">
          <div class="file has-name">
            <label class="file-label">
              <input class="file-input" type="file" name="resume" @change="setFile($event)">
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
          <a class="button is-info" :disabled="!file" @click="updateImage()">Upload!</a>
        </div>
      </div>
    </section>

    <footer class="modal-card-foot" />
  </div>
</template>

<script>
export default {
  name: 'PictureModal',
  props: ['event', 'permissions', 'services', 'showError', 'showSuccess', 'router'],
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
      if (!this.file) {
        return
      }

      const data = new FormData()
      data.append('head_image', this.file)

      this.axios.post(this.services['summeruniversity'] + '/single/' + this.event.id + '/upload', data).then(() => {
        this.showSuccess('Event image is updated.')
        this.router.go(0)
      }).catch((err) => {
        this.showError('Could not update image', err)
      })
    }
  }
}
</script>
