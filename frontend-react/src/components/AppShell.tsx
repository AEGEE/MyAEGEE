// The page around the migrated views: header with the member's menu, the sidebar menu of the
// Vue app (frontend/src/menu.json, filtered the same way) and the main area. Unlike the Vue
// shell it has landmarks, a skip link and a keyboard-operable user menu.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { menu, type MenuCategory, type MenuItem } from 'virtual:vue-app';

import { AppLink, leaveTo } from '../lib/links';
import { href } from '../lib/routes';
import { useSession, type Session } from '../lib/session';
import styles from '../styles/shell.module.css';

const visibleFor = (item: { auth?: string }, session: Session): boolean => {
    if (!session.user && item.auth === 'logged-in') return false;
    if (session.user && item.auth === 'not-logged-in') return false;
    return true;
};

const allowed = (item: MenuItem, session: Session): boolean => !item.permissions
    || item.permissions.some((needed) => session.permissions.some((permission) => permission.combined.includes(needed)));

// The same filtering as components/layout/Sidebar.vue: hide what the member may not see, then
// parents left without children, then empty categories.
const filterMenu = (session: Session): MenuCategory[] => menu
    .map((category) => ({
        ...category,
        components: category.components
            .map((item) => (item.children ? { ...item, children: item.children.filter((child) => allowed(child, session) && visibleFor(child, session)) } : item))
            .filter((item) => !item.children || item.children.length > 0)
            .filter((item) => allowed(item, session) && visibleFor(item, session))
    }))
    .filter((category) => category.components.length > 0 && visibleFor(category, session));

const itemHref = (item: MenuItem): string => (item.name ? href(item.name, item.params) : '#');

function MenuEntry({ item, pathname }: { item: MenuItem; pathname: string }) {
    const listId = useId();
    const containsCurrent = Boolean(item.children?.some((child) => itemHref(child) === pathname));
    const [expanded, setExpanded] = useState(containsCurrent);

    if (item.link) {
        return <li><a href={item.link} target="_blank" rel="noopener noreferrer">{item.label}</a></li>;
    }
    if (item.children) {
        return (
            <li>
                <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
                    {item.label} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                </button>
                <ul id={listId} hidden={!expanded}>
                    {item.children.map((child) => <MenuEntry key={child.name ?? child.label} item={child} pathname={pathname} />)}
                </ul>
            </li>
        );
    }
    const to = itemHref(item);
    return <li><AppLink to={to} aria-current={to === pathname ? 'page' : undefined}>{item.label}</AppLink></li>;
}

function UserMenu({ session }: { session: Session }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);

    if (!session.user) {
        return <a href="/login">Login</a>;
    }

    const logout = async () => {
        await session.logout();
        leaveTo('/login');
    };

    return (
        <div className={styles.user} ref={ref}>
            <button type="button" className={styles.userButton} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
                {session.user.first_name} {session.user.last_name}
            </button>
            <ul id={menuId} className={styles.userMenu} hidden={!open}>
                <li><a href="/members/me">See my account</a></li>
                <li><button type="button" onClick={logout}>Logout</button></li>
            </ul>
        </div>
    );
}

export function AppShell({ children }: { children: ReactNode }) {
    const session = useSession();
    const { pathname } = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <>
            <a className={`button ${styles.skip}`} href="#main">Skip to content</a>
            <header className={styles.header}>
                <a href="/" className={styles.brand}><img src="/images/logo.png" alt="MyAEGEE home" /></a>
                <button type="button" className={`button ${styles.menuToggle}`} aria-expanded={sidebarOpen} aria-controls="sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    Menu
                </button>
                <nav aria-label="Account">
                    <UserMenu session={session} />
                </nav>
            </header>
            <div className={styles.layout}>
                <aside id="sidebar" className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`} aria-label="Main menu">
                    {filterMenu(session).map((category) => (
                        <div key={category.categoryName}>
                            <h2>{category.categoryName}</h2>
                            <ul>
                                {category.components.map((item) => <MenuEntry key={item.name ?? item.label} item={item} pathname={pathname} />)}
                            </ul>
                        </div>
                    ))}
                </aside>
                <main id="main" className={styles.main} tabIndex={-1}>
                    <div className={styles.box}>{children}</div>
                </main>
            </div>
        </>
    );
}
