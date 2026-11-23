<template>
  <div class="field is-fullwidth">
    <label class="label" :for="inputId">{{ label }}</label>
    <div class="control">
      <div class="field has-addons">
        <div class="control is-expanded">
          <input
            class="input"
            :id="inputId"
            :type="displayPassword ? 'text' : 'password'"
            minlength="8"
            :placeholder="placeholder"
            :required="required"
            :value="value"
            @input="$emit('input', $event.target.value)"
          />
        </div>
        <div class="control">
          <button
            type="button"
            class="button is-primary"
            :aria-label="displayPassword ? 'Hide password' : 'Show password'"
            @click="displayPassword = !displayPassword"
          >
            <span class="icon is-small">
              <font-awesome-icon icon="eye" />
            </span>
          </button>
        </div>
      </div>
    </div>
    <slot name="errors-slot" />
  </div>
</template>

<script>
export default {
  name: 'PasswordToggle',
  props: ['value', 'label', 'placeholder', 'required'],
  data () {
    return {
      displayPassword: false
    }
  },
  computed: {
    inputId () {
      return `password-toggle-${this._uid}`
    }
  }
}
</script>
