import React from 'react';

export interface ConflictField {
  fieldName: string;
  displayName: string;
  localValue: unknown;
  serverValue: unknown;
  resolvedValue?: unknown;
}

export interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  conflicts: ConflictField[];
  onResolve: (resolvedConflicts: ConflictField[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  conflicts,
  onResolve,
  onCancel,
  loading = false
}: ConflictResolutionDialogProps) {
  const [resolutions, setResolutions] = React.useState<ConflictField[]>([]);

  // Initialize resolutions when conflicts change
  React.useEffect(() => {
    if (conflicts.length > 0) {
      setResolutions(
        conflicts.map(conflict => ({
          ...conflict,
          resolvedValue: conflict.localValue // Default to local value
        }))
      );
    }
  }, [conflicts]);

  const handleFieldResolution = (fieldName: string, value: unknown) => {
    setResolutions(prev =>
      prev.map(resolution =>
        resolution.fieldName === fieldName
          ? { ...resolution, resolvedValue: value }
          : resolution
      )
    );
  };

  const handleResolve = () => {
    onResolve(resolutions);
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">empty</span>;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : <span className="text-gray-400 italic">empty</span>;
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string' && value.trim() === '') {
      return <span className="text-gray-400 italic">empty</span>;
    }
    return String(value);
  };



  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={() => !loading && onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="conflict-dialog"
      >
        {/* Header */}
        <div className="mb-6 border-b pb-4">
          <h2 id="conflict-dialog-title" className="text-xl font-semibold text-gray-900 mb-2">
            🔄 Edit Conflict Detected
          </h2>
          <p className="text-gray-600 text-sm">
            The {resourceType} has been modified by another user. Please review the conflicting fields below and choose which values to keep.
          </p>
          <div className="mt-2 text-xs text-gray-500">
            Resource: {resourceType} (ID: {resourceId})
          </div>
        </div>

        {/* Conflicts */}
        <div className="flex-1 overflow-y-auto">
          {conflicts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No conflicts to resolve
            </div>
          ) : (
            <div className="space-y-6">
              {conflicts.map((conflict) => {
                const resolution = resolutions.find(r => r.fieldName === conflict.fieldName);
                const resolvedValue = resolution?.resolvedValue;

                return (
                  <div key={conflict.fieldName} className="border rounded-lg p-4 bg-gray-50">
                    <div className="mb-3">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {conflict.displayName}
                      </h3>
                      <div className="text-xs text-gray-500">
                        Field: {conflict.fieldName}
                      </div>
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Your Changes (Local) */}
                      <div className="border rounded-md">
                        <div className="bg-blue-50 border-b px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">Your Changes</span>
                            <button
                              type="button"
                              onClick={() => handleFieldResolution(conflict.fieldName, conflict.localValue)}
                              className={`px-2 py-1 text-xs rounded ${
                                resolvedValue === conflict.localValue
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              Use This
                            </button>
                          </div>
                        </div>
                        <div className="p-3 text-sm">
                          {formatValue(conflict.localValue)}
                        </div>
                      </div>

                      {/* Server Version */}
                      <div className="border rounded-md">
                        <div className="bg-green-50 border-b px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-900">Latest Version</span>
                            <button
                              type="button"
                              onClick={() => handleFieldResolution(conflict.fieldName, conflict.serverValue)}
                              className={`px-2 py-1 text-xs rounded ${
                                resolvedValue === conflict.serverValue
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white text-green-600 border border-green-600 hover:bg-green-50'
                              }`}
                            >
                              Use This
                            </button>
                          </div>
                        </div>
                        <div className="p-3 text-sm">
                          {formatValue(conflict.serverValue)}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Preview */}
                    <div className="border border-yellow-300 rounded-md bg-yellow-50">
                      <div className="bg-yellow-100 border-b border-yellow-300 px-3 py-2">
                        <span className="text-sm font-medium text-yellow-900">Resolution</span>
                      </div>
                      <div className="p-3 text-sm text-yellow-800">
                        Will be saved as: <span className="font-medium">{formatValue(resolvedValue)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-6 border-t border-gray-200 mt-6">
          <div className="flex items-center text-sm text-gray-500">
            <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded mr-2"></span>
            Your changes
            <span className="w-3 h-3 bg-green-100 border border-green-300 rounded ml-4 mr-2"></span>
            Latest version
            <span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded ml-4 mr-2"></span>
            Resolution
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={onCancel}
              disabled={loading}
              data-testid="conflict-discard-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleResolve}
              disabled={loading || conflicts.length === 0}
              data-testid="conflict-overwrite-btn"
            >
              {loading ? 'Resolving...' : `Resolve ${conflicts.length} Conflict${conflicts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConflictResolutionDialog;
