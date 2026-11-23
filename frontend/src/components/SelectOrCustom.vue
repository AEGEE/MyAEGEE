<template>
  <div class="fields">
    <label class="label" :for="selectId">{{ label }}</label>
    <div class="field has-addons">
      <div class="control">
        <div class="select">
          <select :id="selectId" :value="selectValue" @change="select($event.target.value)">
            <option value="">Choose…</option>
            <option v-for="(val, index) in values" v-bind:key="index" :value="val">
              {{ val }}
            </option>
            <option value="custom">Custom...</option>
          </select>
        </div>
      </div>
      <div class="control is-expanded" v-show="selectValue === 'custom'">
        <input
          class="input"
          type="text"
          :required="required"
          :aria-label="`${label} (custom)`"
          :value="customValue"
          @input="type($event.target.value)" />
      </div>
      <slot name="errors-slot" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'SelectOrCustom',
  props: ['value', 'label', 'values', 'required'],
  data () {
    return {
      // One of the values, 'custom', or '' while nothing is chosen.
      selectValue: '',
      customValue: ''
    }
  },
  computed: {
    selectId () {
      return `select-or-custom-${this._uid}`
    },
    current () {
      return this.selectValue === 'custom' ? this.customValue : this.selectValue
    }
  },
  methods: {
    select (selectValue) {
      this.selectValue = selectValue
      this.$emit('input', this.current)
    },
    type (customValue) {
      this.customValue = customValue
      this.$emit('input', this.current)
    },
    show (value) {
      // What this component just emitted itself: nothing to change.
      if (value === this.current) {
        return
      }

      if (value === null || value === undefined || value === '') {
        this.selectValue = ''
        this.customValue = ''
      } else if (this.values.includes(value)) {
        this.selectValue = value
        this.customValue = ''
      } else {
        this.selectValue = 'custom'
        this.customValue = value
      }
    }
  },
  watch: {
    value (value) {
      this.show(value)
    }
  },
  created () {
    this.show(this.value)
  }
}
</script>
