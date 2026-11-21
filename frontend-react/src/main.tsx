import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './lib/toast';
import './styles/global.css';

const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } }
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <SessionProvider>
                    <App />
                </SessionProvider>
            </ToastProvider>
        </QueryClientProvider>
    </StrictMode>
);
