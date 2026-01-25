import type { AST } from "vue-eslint-parser";
declare function getLiteralAttributeValue(node: AST.VElement, name: string): string | number | bigint | boolean | RegExp | null;
export default getLiteralAttributeValue;
