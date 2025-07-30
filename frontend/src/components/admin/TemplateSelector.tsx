import React from 'react';

interface TemplateSelectorProps {
  templates: { id: string; name: string; }[];
  onSelect: (templateId: string) => void;
  selectedTemplateId: string | null;
}

export default function TemplateSelector({ templates, onSelect, selectedTemplateId }: TemplateSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedTemplateId === template.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}
