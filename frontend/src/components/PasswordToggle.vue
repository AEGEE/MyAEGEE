<template>
  <div class="field is-fullwidth">
    <label class="label">{{ label }}</label>
    <div class="control">

      <div class="field has-addons">
        <div class="control is-expanded">
          <input class="input" :data-cy="dataCy" :type="displayPassword ? 'text' : 'password'" minlength="8" :placeholder="placeholder" :required="required" v-model="value">
        </div>
        <div class="control">
          <a class="button is-primary" @click="displayPassword = !displayPassword">
            <span class="icon is-small">
              <font-awesome-icon icon="eye" />
            </span>
          </a>
        </div>
      </div>
    </div>
    <slot name="errors-slot"></slot>
  </div>
</template>

<script>
export default {
  name: 'PasswordToggle',
  props: ['value', 'label', 'placeholder', 'required', 'data-cy'],
  data () {
    return {
      displayPassword: false
    }
  },
  watch: {
    value () {
      this.$emit('input', this.value)
    }
  },
  mounted () {

  }
}
</script>
