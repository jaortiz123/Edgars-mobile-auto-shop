import React, { useState, KeyboardEvent, useRef } from 'react';
import { Badge } from '@/components/ui/Badge';
import { X, Plus } from 'lucide-react';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function TagsInput({
  value = [],
  onChange,
  placeholder = "Add tags...",
  maxTags = 10,
  maxTagLength = 50,
  disabled = false,
  className = '',
  error
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = (newTag: string) => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag) return;

    // Prevent duplicates (case-insensitive)
    if (value.some(tag => tag.toLowerCase() === trimmedTag.toLowerCase())) {
      setInputValue('');
      return;
    }

    // Respect max tags limit
    if (value.length >= maxTags) {
      setInputValue('');
      return;
    }

    // Respect max tag length
    if (trimmedTag.length > maxTagLength) {
      return; // Don't clear input so user can edit
    }

    onChange([...value, trimmedTag]);
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const trimmedValue = inputValue.trim();

    if (e.key === 'Enter' && trimmedValue) {
      e.preventDefault();
      handleAddTag(trimmedValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when pressing backspace on empty input
      e.preventDefault();
      onChange(value.slice(0, -1));
    } else if (e.key === ',' && trimmedValue) {
      // Allow comma-separated input
      e.preventDefault();
      handleAddTag(trimmedValue);
    }
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      handleAddTag(trimmedValue);
    }
  };

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const isMaxTagsReached = value.length >= maxTags;
  const isInputTooLong = inputValue.length > maxTagLength;

  return (
    <div className={className}>
      <div
        className={`
          min-h-[2.5rem] w-full border rounded-md px-3 py-2
          focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-text'}
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${isInputFocused ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        onClick={handleContainerClick}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {/* Render existing tags */}
          {value.map((tag, index) => (
            <Badge
              key={`${tag}-${index}`}
              variant="secondary"
              className="flex items-center gap-1 text-xs py-1 px-2"
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                  className="hover:bg-gray-300 rounded-full p-0.5 ml-1"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X size={12} />
                </button>
              )}
            </Badge>
          ))}

          {/* Input for new tags */}
          {!disabled && !isMaxTagsReached && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={handleInputBlur}
              placeholder={value.length === 0 ? placeholder : ''}
              className="border-none outline-none bg-transparent flex-1 min-w-[120px] text-sm"
              disabled={disabled}
            />
          )}

          {/* Add button for visual clarity */}
          {!disabled && !isMaxTagsReached && (
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Add tag"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Helper text and error messages */}
      <div className="mt-1 text-xs space-y-1">
        {error && (
          <div className="text-red-500">{error}</div>
        )}

        {isInputTooLong && (
          <div className="text-red-500">
            Tag too long ({inputValue.length}/{maxTagLength} characters)
          </div>
        )}

        {isMaxTagsReached && (
          <div className="text-orange-600">
            Maximum {maxTags} tags allowed
          </div>
        )}

        {!error && !isInputTooLong && (
          <div className="text-gray-500">
            {value.length}/{maxTags} tags • Press Enter or comma to add • Backspace to remove
          </div>
        )}
      </div>
    </div>
  );
}
