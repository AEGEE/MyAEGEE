import Vue from 'vue';
const dummyContainer = typeof document !== 'undefined' ? document.createDocumentFragment() : null;
const TransportContainer = Vue.extend({
    props: {
        inPlaceOf: typeof Element !== 'undefined' ? Element : Object,
        reportEl: Function,
        elTag: String,
        elClasses: Array,
        elStyle: Object,
        elAttrs: Object
    },
    render(h) {
        return h(this.elTag, {
            class: this.elClasses,
            style: this.elStyle,
            attrs: this.elAttrs,
        }, this.$slots.default || []);
    },
    mounted() {
        replaceEl(this.$el, this.inPlaceOf);
        this.inPlaceOf.style.display = 'none';
        this.reportEl(this.$el);
    },
    updated() {
        /*
        If the ContentContainer's tagName changed, it will create a new DOM element in its
        original place. Detect this and re-replace.
        */
        if (dummyContainer && this.inPlaceOf.parentNode !== dummyContainer) {
            replaceEl(this.$el, this.inPlaceOf);
            this.reportEl(this.$el);
        }
    },
    beforeDestroy() {
        // protect against Preact recreating and rerooting inPlaceOf element
        if (dummyContainer && this.inPlaceOf.parentNode === dummyContainer) {
            dummyContainer.removeChild(this.inPlaceOf);
        }
        this.reportEl(null);
    }
});
export default TransportContainer;
function replaceEl(subject, inPlaceOf) {
    var _a;
    (_a = inPlaceOf.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(subject, inPlaceOf.nextSibling);
    if (dummyContainer) {
        dummyContainer.appendChild(inPlaceOf);
    }
}
//# sourceMappingURL=TransportContainer.js.map