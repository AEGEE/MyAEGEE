// The routes this app serves. They have to match frontend/src/migrated-routes.json, the list
// the gateway uses to send paths here (checked by src/routes.test.ts). Page titles and whether a
// page needs a login come from the Vue app's route table.
import { useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router';

import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { goToLogin } from './lib/api';
import { isReactPath, leaveTo } from './lib/links';
import { pageTitle, vueRoute } from './lib/routes';
import { useSession } from './lib/session';
import { ApplyPage } from './pages/ApplyPage';
import { EventPage } from './pages/EventPage';
import { EventsList } from './pages/EventsList';

// Sets the title, and sends visitors to the login page (or members with an incomplete profile
// to /profile/update) the way the Vue router's beforeEach does.
function Page({ name, children }: { name: string; children: ReactNode }) {
    const session = useSession();
    const { pathname, search } = useLocation();
    const { auth } = vueRoute(name);

    useEffect(() => {
        document.title = pageTitle(name);
    }, [name]);

    const needsLogin = auth && session.status === 'ready' && !session.user;
    const needsProfile = auth && session.user && Object.keys(session.validationErrors).length > 0;
    useEffect(() => {
        if (needsLogin) goToLogin(pathname + search);
        else if (needsProfile) leaveTo('/profile/update');
    }, [needsLogin, needsProfile, pathname, search]);

    if (session.status === 'loading' || needsLogin || needsProfile) return <Loading />;
    return <>{children}</>;
}

// Paths of the Vue app that look like ours (/events/new matches /events/:id) or that a
// history entry brings here: load them from the server, which serves them from the Vue app.
function Layout() {
    const { pathname, search } = useLocation();
    const ours = isReactPath(pathname);
    useEffect(() => {
        if (!ours) leaveTo(pathname + search);
    }, [ours, pathname, search]);

    return <AppShell>{ours ? <Outlet /> : <Loading />}</AppShell>;
}

export const routes: RouteObject[] = [
    {
        element: <Layout />,
        children: [
            { path: '/events', element: <Page name="oms.events.list.all"><EventsList scope="all" /></Page> },
            { path: '/events/participating', element: <Page name="oms.events.list.participating"><EventsList scope="participating" /></Page> },
            { path: '/events/organizing', element: <Page name="oms.events.list.organizing"><EventsList scope="organizing" /></Page> },
            { path: '/events/:id', element: <Page name="oms.events.view"><EventPage /></Page> },
            { path: '/events/:id/applications/:application_id', element: <Page name="oms.events.apply"><ApplyPage /></Page> },
            { path: '*', element: null }
        ]
    }
];

const router = createBrowserRouter(routes);

export function App() {
    return <RouterProvider router={router} />;
}
