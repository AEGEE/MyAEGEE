<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add member</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body" style="height:200px;">
      <div class="field has-addons">
        <b-autocomplete
          v-model="addedMemberName"
          :data="members"
          field="title"
          :loading="isLoadingMembers"
          @input="fetchMembers"
          expanded="true"
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
  name: 'AddMemberModal',
  props: ['circle', 'services', 'showDanger', 'showSuccess'],
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

      // If circle is bound to a body, search for body members. If not, use global search.
      const url = this.circle.body_id
        ? this.services['oms-core-elixir'] + '/bodies/' + this.circle.body_id + '/members'
        : this.services['oms-core-elixir'] + '/members'

      this.axios.get(url, {
        cancelToken: this.token.token,
        params: { query: this.addedMemberName }
      }).then((response) => {
        // Transform members if the circle is bound (there's another API response format)
        this.members = this.circle.body_id
          ? response.data.data.map(entry => entry.member)
          : response.data.data

        this.isLoadingMembers = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingMembers = false
        this.showDanger('Could not fetch members: ' + err.message)
      })
    },
    addMember (member) {
      this.axios.post(this.services['oms-core-elixir'] + '/circles/' + this.circle.id + '/add_member', {
        member_id: member.id
      }).then(() => {
        this.showSuccess('Member is added.')
        this.$parent.close()
      }).catch((err) => {
        const message = 'Could not add member: ' +
          (err.response.status === 422 && 'circle_membership_unique' in err.response.data.errors
            ? 'This person is already a member of this circle.'
            : err.message)

        this.showDanger(message)
      })
    }
  }
}
</script>