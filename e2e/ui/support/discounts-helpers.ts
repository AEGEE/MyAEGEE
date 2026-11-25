// Helpers of the discounts specs.
import { expect, type Page } from '@playwright/test';

// A page fades in when it opens (a CSS transition). Until that is over, a loading overlay of
// the page only covers the page's box: check what an overlay covers once it is. A transition
// that is cancelled ends too; endless animations (a spinner) don't count.
export const pageFadedIn = async (page: Page): Promise<void> => {
    await expect.poll(() => page.evaluate(async () => {
        const transitions = () => document.getAnimations().filter((animation) => animation instanceof CSSTransition);
        await Promise.all(transitions().map((transition) => transition.finished.catch(() => undefined)));
        return transitions().length;
    }), { message: 'the page has faded in' }).toBe(0);
};
