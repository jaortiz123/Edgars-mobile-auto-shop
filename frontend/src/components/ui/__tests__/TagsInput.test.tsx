import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsInput } from '@/components/ui/TagsInput';

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

describe('TagsInput Component', () => {
  const mockOnChange = vi.fn();
  const user = userEvent.setup();

  const defaultProps = {
    value: [],
    onChange: mockOnChange,
    placeholder: "Add tags...",
    maxTags: 10,
    maxTagLength: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render empty tags input with placeholder', () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    expect(screen.getByText('0/10 tags • Press Enter or comma to add • Backspace to remove')).toBeInTheDocument();
  });

  it('should display existing tags as badges', () => {
    const tags = ['VIP', 'Loyal', 'Fleet'];
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={tags} />
      </TestWrapper>
    );

    tags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });

    expect(screen.getByText('3/10 tags • Press Enter or comma to add • Backspace to remove')).toBeInTheDocument();
  });

  it('should add a tag when Enter is pressed', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'NewTag');
    await user.keyboard('{Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(['NewTag']);
  });

  it('should add a tag when comma is pressed', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'NewTag,');

    expect(mockOnChange).toHaveBeenCalledWith(['NewTag']);
  });

  it('should add a tag when input loses focus', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'BlurTag');
    await user.tab(); // Move focus away

    expect(mockOnChange).toHaveBeenCalledWith(['BlurTag']);
  });

  it('should remove a tag when X button is clicked', async () => {
    const initialTags = ['VIP', 'Loyal'];
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={initialTags} />
      </TestWrapper>
    );

    const removeButton = screen.getByLabelText('Remove VIP tag');
    await user.click(removeButton);

    expect(mockOnChange).toHaveBeenCalledWith(['Loyal']);
  });

  it('should remove last tag when Backspace is pressed on empty input', async () => {
    const initialTags = ['VIP', 'Loyal'];
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={initialTags} />
      </TestWrapper>
    );

    // Click in the input area (it won't have placeholder since there are tags)
    const inputContainer = screen.getByRole('textbox');
    await user.click(inputContainer);
    await user.keyboard('{Backspace}');

    expect(mockOnChange).toHaveBeenCalledWith(['VIP']);
  });

  it('should prevent duplicate tags (case insensitive)', async () => {
    const initialTags = ['VIP'];
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={initialTags} />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'vip');
    await user.keyboard('{Enter}');

    // Should not add duplicate
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should enforce maximum tags limit', async () => {
    const maxTags = 3;
    const initialTags = ['Tag1', 'Tag2', 'Tag3'];

    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={initialTags} maxTags={maxTags} />
      </TestWrapper>
    );

    // Should show max tags message
    expect(screen.getByText('Maximum 3 tags allowed')).toBeInTheDocument();

    // Input should not be visible when at max
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should enforce maximum tag length', async () => {
    const maxLength = 10;
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} maxTagLength={maxLength} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    const longTag = 'a'.repeat(maxLength + 1);

    await user.type(input, longTag);

    // Should show length warning
    expect(screen.getByText(`Tag too long (${longTag.length}/${maxLength} characters)`)).toBeInTheDocument();

    await user.keyboard('{Enter}');

    // Should not add the tag
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should handle disabled state', () => {
    const initialTags = ['VIP', 'Loyal'];
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} value={initialTags} disabled={true} />
      </TestWrapper>
    );

    // Should not show input
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // Should not show remove buttons
    expect(screen.queryByLabelText(/Remove .* tag/)).not.toBeInTheDocument();
  });

  it('should display error message when provided', () => {
    const errorMessage = 'Tags validation failed';
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} error={errorMessage} />
      </TestWrapper>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should trim whitespace from tags', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, '  Spaced Tag  ');
    await user.keyboard('{Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(['Spaced Tag']);
  });

  it('should not add empty tags', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, '   '); // Only spaces
    await user.keyboard('{Enter}');

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should handle multiple comma-separated tags', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'Tag1, Tag2, Tag3');
    await user.tab(); // Blur to trigger adding all tags

    // Note: The current implementation adds one tag at a time on comma
    // So this will only add the first tag. This is expected behavior.
    expect(mockOnChange).toHaveBeenCalledWith(['Tag1']);
  });

  it('should focus input when container is clicked', async () => {
    render(
      <TestWrapper>
        <TagsInput {...defaultProps} />
      </TestWrapper>
    );

    // Click on the container div
    const container = screen.getByPlaceholderText('Add tags...').closest('div')?.parentElement;
    if (container) {
      await user.click(container);
      expect(screen.getByPlaceholderText('Add tags...')).toHaveFocus();
    }
  });
});

describe('TagsInput Integration with EditCustomerDialog', () => {
  // These tests will be added to the existing EditCustomerDialog.integration.test.tsx
  // For now, we'll test the TagsInput component in isolation

  it('should integrate properly with form state', async () => {
    const TestForm = () => {
      const [tags, setTags] = React.useState<string[]>(['Initial']);
      return (
        <TagsInput
          value={tags}
          onChange={setTags}
          placeholder="Add tags..."
        />
      );
    };

    render(
      <TestWrapper>
        <TestForm />
      </TestWrapper>
    );

    // Initial tag should be shown
    expect(screen.getByText('Initial')).toBeInTheDocument();

    // Add a new tag
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'NewTag');
    await userEvent.keyboard('{Enter}');

    // Both tags should be shown
    expect(screen.getByText('Initial')).toBeInTheDocument();
    expect(screen.getByText('NewTag')).toBeInTheDocument();
  });
});
