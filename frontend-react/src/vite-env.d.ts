/// <reference types="vite/client" />

declare module 'virtual:vue-app' {
    export interface VueRoute {
        name: string;
        path: string;
        label: string;
        auth: boolean;
    }

    export interface MenuItem {
        name?: string;
        link?: string;
        label: string;
        icon?: string;
        params?: Record<string, string>;
        auth?: 'logged-in' | 'not-logged-in';
        permissions?: string[];
        children?: MenuItem[];
    }

    export interface MenuCategory {
        categoryName: string;
        auth?: 'logged-in' | 'not-logged-in';
        components: MenuItem[];
    }

    export const routes: VueRoute[];
    export const menu: MenuCategory[];
    export const migratedPatterns: string[];
}

declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}
