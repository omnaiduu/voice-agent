import { createTRPCReact } from '@trpc/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from 'backend/trpc';



// Clean and simple
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

import { createTRPCContext } from '@trpc/tanstack-react-query';


export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();