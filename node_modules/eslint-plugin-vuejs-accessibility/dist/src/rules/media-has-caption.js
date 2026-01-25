"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
function isCaptionsTrackElement(node) {
    const kind = node.type === "VElement" && (0, utils_1.getElementAttributeValue)(node, "kind");
    return kind && typeof kind === "string" && kind.toLowerCase() === "captions";
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("media-has-caption")
        },
        messages: {
            default: "Media elements such as <audio> and <video> must have a <track> for captions."
        },
        schema: [
            {
                type: "object",
                properties: {
                    audio: {
                        type: "array",
                        items: { type: "string" }
                    },
                    track: {
                        type: "array",
                        items: { type: "string" }
                    },
                    video: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const { audio = [], track = [], video = [] } = context.options[0] || {};
                const mediaElementTypes = audio
                    .concat(video)
                    .map(utils_1.makeKebabCase)
                    .concat("audio", "video");
                if (!mediaElementTypes.includes((0, utils_1.getElementType)(node))) {
                    return;
                }
                const muted = (0, utils_1.getElementAttribute)(node, "muted");
                if (muted && ((0, utils_1.getAttributeValue)(muted) || "").toString() !== "false") {
                    return;
                }
                const trackElementTypes = track.map(utils_1.makeKebabCase).concat("track");
                const trackElements = node.children.filter((child) => child.type === "VElement" &&
                    trackElementTypes.includes((0, utils_1.getElementType)(child)));
                if (trackElements.length === 0 ||
                    !trackElements.some(isCaptionsTrackElement)) {
                    context.report({ node: node, messageId: "default" });
                }
            }
        });
    }
};
exports.default = rule;
