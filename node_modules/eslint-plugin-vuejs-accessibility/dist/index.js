"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const recommended_1 = __importDefault(require("./configs/recommended"));
const recommended_2 = __importDefault(require("./configs/flat/recommended"));
const alt_text_1 = __importDefault(require("./rules/alt-text"));
const anchor_has_content_1 = __importDefault(require("./rules/anchor-has-content"));
const aria_props_1 = __importDefault(require("./rules/aria-props"));
const aria_role_1 = __importDefault(require("./rules/aria-role"));
const aria_unsupported_elements_1 = __importDefault(require("./rules/aria-unsupported-elements"));
const click_events_have_key_events_1 = __importDefault(require("./rules/click-events-have-key-events"));
const form_control_has_label_1 = __importDefault(require("./rules/form-control-has-label"));
const heading_has_content_1 = __importDefault(require("./rules/heading-has-content"));
const iframe_has_title_1 = __importDefault(require("./rules/iframe-has-title"));
const interactive_supports_focus_1 = __importDefault(require("./rules/interactive-supports-focus"));
const label_has_for_1 = __importDefault(require("./rules/label-has-for"));
const media_has_caption_1 = __importDefault(require("./rules/media-has-caption"));
const mouse_events_have_key_events_1 = __importDefault(require("./rules/mouse-events-have-key-events"));
const no_access_key_1 = __importDefault(require("./rules/no-access-key"));
const no_aria_hidden_on_focusable_1 = __importDefault(require("./rules/no-aria-hidden-on-focusable"));
const no_autofocus_1 = __importDefault(require("./rules/no-autofocus"));
const no_distracting_elements_1 = __importDefault(require("./rules/no-distracting-elements"));
const no_onchange_1 = __importDefault(require("./rules/no-onchange"));
const no_redundant_roles_1 = __importDefault(require("./rules/no-redundant-roles"));
const no_role_presentation_on_focusable_1 = __importDefault(require("./rules/no-role-presentation-on-focusable"));
const no_static_element_interactions_1 = __importDefault(require("./rules/no-static-element-interactions"));
const role_has_required_aria_props_1 = __importDefault(require("./rules/role-has-required-aria-props"));
const tabindex_no_positive_1 = __importDefault(require("./rules/tabindex-no-positive"));
const configs = {
    recommended: recommended_1.default,
    "flat/recommended": recommended_2.default
};
const rules = {
    "alt-text": alt_text_1.default,
    "anchor-has-content": anchor_has_content_1.default,
    "aria-props": aria_props_1.default,
    "aria-role": aria_role_1.default,
    "aria-unsupported-elements": aria_unsupported_elements_1.default,
    "click-events-have-key-events": click_events_have_key_events_1.default,
    "form-control-has-label": form_control_has_label_1.default,
    "heading-has-content": heading_has_content_1.default,
    "iframe-has-title": iframe_has_title_1.default,
    "interactive-supports-focus": interactive_supports_focus_1.default,
    "label-has-for": label_has_for_1.default,
    "media-has-caption": media_has_caption_1.default,
    "mouse-events-have-key-events": mouse_events_have_key_events_1.default,
    "no-access-key": no_access_key_1.default,
    "no-aria-hidden-on-focusable": no_aria_hidden_on_focusable_1.default,
    "no-autofocus": no_autofocus_1.default,
    "no-distracting-elements": no_distracting_elements_1.default,
    "no-onchange": no_onchange_1.default,
    "no-redundant-roles": no_redundant_roles_1.default,
    "no-role-presentation-on-focusable": no_role_presentation_on_focusable_1.default,
    "no-static-element-interactions": no_static_element_interactions_1.default,
    "role-has-required-aria-props": role_has_required_aria_props_1.default,
    "tabindex-no-positive": tabindex_no_positive_1.default
};
module.exports = {
    configs,
    rules
};
