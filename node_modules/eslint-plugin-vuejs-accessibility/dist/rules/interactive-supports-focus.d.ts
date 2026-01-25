import type { Rule } from "eslint";
import { ARIARoleDefinitionKey } from "aria-query";
export interface InteractiveSupportsFocus extends Rule.RuleModule {
    interactiveHandlers: string[];
    interactiveRoles: ARIARoleDefinitionKey[];
}
declare const rule: InteractiveSupportsFocus;
export default rule;
