<template>
  <div class="fields">
    <label class="label">{{ label }}</label>
    <div class="field has-addons">
      <div class="control">
        <div class="select">
          <select v-model="selectValue">
            <option v-for="(val, index) in values" v-bind:key="index" :value="val">{{ val }}</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
      </div>
      <div class="control is-expanded" v-show="selectValue === 'custom'">
        <input
          class="input"
          type="text"
          :required="required"
          v-model="customValue" />
      </div>
      <slot name="errors-slot"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SelectOrCustom',
  props: ['value', 'label', 'values', 'required'],
  data () {
    return {
      selectValue: '',
      customValue: ''
    }
  },
  watch: {
    selectValue () {
      this.value = (this.selectValue === 'custom') ? this.customValue : this.selectValue
      this.$emit('input', this.value)
    },
    customValue () {
      this.value = this.customValue
      this.$emit('input', this.value)
    },
    value () {
      this.selectValue = this.values.includes(this.value) ? this.value : 'custom'
      this.customValue = this.value
    }
  },
  mounted () {
    this.selectValue = this.values.includes(this.value) ? this.value : 'custom'
    this.customValue = this.value
  }
}
</script>
