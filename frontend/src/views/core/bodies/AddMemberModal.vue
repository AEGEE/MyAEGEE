<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add member</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body" style="height:200px;">
      <div class="field has-addons">
        <b-autocomplete
          v-model="memberName"
          :data="members"
          field="title"
          :loading="isLoadingMembers"
          @input="fetchMembers"
          :expanded="true"
          @select="option => addMember(option)">

          <template slot-scope="props">
            <div class="media">
              <div class="media-content">{{ props.option.first_name }} {{ props.option.last_name }}</div>
            </div>
          </template>
          </b-autocomplete>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AddBodyMemberModal',
  props: ['body', 'services', 'showError', 'showSuccess'],
  data () {
    return {
      isLoadingMembers: false,
      memberName: '',
      members: [],
      token: null
    }
  },
  methods: {
    fetchMembers () {
      this.isLoadingMembers = true
      this.members = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/members', {
        cancelToken: this.token.token,
        params: { query: this.memberName }
      }).then((response) => {
        this.members = response.data.data
        this.isLoadingMembers = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingMembers = false
        this.showError('Could not fetch members', err)
      })
    },
    addMember (member) {
      this.axios.post(this.services['core'] + '/bodies/' + this.body.id + '/members', {
        user_id: member.id
      }).then(() => {
        this.showSuccess('Member is added.')
        this.$parent.close()
      }).catch((err) => {
        if (err.response.status === 422) {
          this.showError('Could not add member: this person is already a member of this body.')
        } else {
          this.showError('Could not add member', err)
        }
      })
    }
  }
}
</script>
