import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';

function Harness({ id }: { id: string }) {
	const q = useCustomerProfile(id, {});
	return (
		<div>
			{q.isLoading && <span data-testid="state">loading</span>}
			{q.isError && <span data-testid="state">error</span>}
			{q.data && <span data-testid="state">loaded:{q.data.customer.name}</span>}
		</div>
	);
}

describe('useCustomerProfile basic load', () => {
	it('loads profile data successfully (happy path)', async () => {
		const qc = new QueryClient();
		const body = JSON.stringify({ data: { customer: { id: 'cust-etag', name: 'Etag Tester' }, vehicles: [], appointments: [], metrics: {}, includes: [] } });
		const original = global.fetch;
		const fetchMock = vi.fn(async () => new Response(body, { status: 200, headers: { ETag: 'W/"profile-v1"' } }));
		(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

		render(
			<QueryClientProvider client={qc}>
				<Harness id="cust-etag" />
			</QueryClientProvider>
		);

		await waitFor(() => {
			const txt = screen.getByTestId('state').textContent || '';
			if (txt === 'loading') throw new Error('still loading');
			expect(txt).toBe('loaded:Etag Tester');
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		(globalThis as unknown as { fetch: typeof fetch }).fetch = original;
	});
});

export {};
