import type { AST } from "vue-eslint-parser";
/**
 * Returns a kebab-normalized string representing the element node name
 * or, if the `is` attribute is a string, its value if present.
 * @example <div is="foo-bar"> => "foo-bar"
 * @example <foo-bar> => "foo-bar"
 * @example <div> => "div"
 */
declare function getElementType(node: AST.VElement): string;
export default getElementType;
