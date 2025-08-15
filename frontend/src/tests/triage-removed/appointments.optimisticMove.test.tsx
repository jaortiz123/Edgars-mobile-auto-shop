// Deprecated legacy test referencing removed AppointmentContext.
// Replaced with a skipped placeholder to retain filename without executing obsolete logic.
import { describe, it } from 'vitest';
describe.skip('appointments.optimisticMove (deprecated)', () => {
  it('skipped', () => {});
});
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many moves. Please wait a moment.', { key: 'move-rate-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('400 invalid-transition path rolls back and shows invalid-transition toast', async () => {
    apiMocks.moveAppointment.mockRejectedValue({ response: { status: 400, data: { errors: [{ detail: 'Not allowed transition' }] } } });
    appRender(<TestComponent />);
    
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    await user.click(screen.getByText('Move'));
    
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That status change is not allowed.', { key: 'move-invalid-1' }));
    expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1');
  });

  it('should track mock factory metrics and request patterns', async () => {
    apiMocks.moveAppointment.mockResolvedValue({ id: '1', status: 'IN_PROGRESS', position: 2 });
    appRender(<TestComponent />);
    
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId('cards').textContent).toContain('1-SCHEDULED-1'));
    await user.click(screen.getByText('Move'));
    
    await waitFor(() => {
      expect(apiMocks.moveAppointment).toHaveBeenCalledTimes(1);
    });
    expect(apiMocks.moveAppointment).toHaveBeenCalledWith('1', { status: 'IN_PROGRESS', position: 2 });
  });
});
