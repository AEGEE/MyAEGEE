// The about page (/about): what MyAEGEE is built with and by whom. Public, no API calls.
import { test, expect } from '../support/test.ts';

test.use({ session: 'anonymous' });

test.describe('about page', () => {
    test('shows the title and its four sections to a visitor', async ({ page }) => {
        await page.goto('/about');

        await expect(page.getByRole('heading', { level: 1, name: 'MyAEGEE - Online Membership System' })).toBeVisible();
        await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Technologies used', 'Services used', 'Microservices', 'Developers']);
        await expect(page.getByRole('link', { name: 'Font Awesome' })).toHaveAttribute('href', 'https://fontawesome.com/');
        await expect(page.getByRole('link', { name: 'Rik Smale' })).toHaveAttribute('href', 'https://github.com/wikirik');
    });

    test('the logos of the services used are named and open their site in a new tab', async ({ page }) => {
        await page.goto('/about');

        const logos = [
            ['Docker', 'https://www.docker.com/'],
            ['Circle CI', 'https://circleci.com/'],
            ['1password', 'https://1password.com/'],
            ['Microsoft Azure', 'https://azure.microsoft.com/en-us/'],
            ['Elastic', 'https://www.elastic.co/']
        ];
        for (const [name, href] of logos) {
            const link = page.getByRole('link', { name, exact: true }).filter({ has: page.getByRole('img', { name }) });
            await expect(link).toHaveAttribute('href', href);
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }

        for (const name of ['https://myaegee.slack.com/', 'AEGEE\'s helpdesk']) {
            await expect(page.getByRole('link', { name })).toHaveAttribute('target', '_blank');
            await expect(page.getByRole('link', { name })).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });
});
