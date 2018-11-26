<template>
<div class="content has-text-centered login-block">
  <div class="columns is-vcentered">
    <div class="column is-6 is-offset-3">
      <div class="box">
        <div v-show="error" style="color:red; word-wrap:break-word;">{{ error }}</div>
        <form v-on:submit.prevent="login">
          <label class="label">Email</label>
          <p class="control">
            <input v-model="data.username" required class="input" type="email" placeholder="email@example.org">
          </p>
          <label class="label">Password</label>
          <p class="control">
            <input v-model="data.password" required class="input" type="password" placeholder="password">
          </p>

          <hr>
          <p class="control">
            <button type="submit" class="button is-primary">Login</button>
            <router-link :to="{ name: 'oms.register', params: { id: 'default' } }" class="button">Register</router-link>
            <router-link :to="{ name: 'oms.password_reset' }" class="button">Forgot your password?</router-link>
          </p>
        </form>
      </div>
    </div>
  </div>
</div>
</template>

<script>
export default {
  name: 'Login',
  data () {
    return {
      data: {
        username: '',
        password: ''
      },
      error: null
    }
  },
  methods: {
    login () {
      this.error = null
      this.$auth.login(this.data).then((res) => {
        this.$router.push('/dashboard')
      }).catch((err) => {
        if (err.response && err.response.data && err.response.data.message) {
          this.error = err.response.data.message
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', err.message)
          this.error = 'An error occured while logging in.'
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.is-title {
    text-transform: capitalize;
}

.login-block {
  width: 100%
}
</style>
