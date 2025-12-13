'use client';

import { useState } from 'react';
import clsx from 'clsx';

type MultiSelectProps = {
  label?: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  error?: string;
};

export default function MultiSelect({ 
  label, 
  options, 
  values, 
  onChange, 
  placeholder = 'Select options',
  error 
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-ink">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'w-full rounded-md border bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-primary focus:outline-none',
            error ? 'border-red-300' : 'border-slate-200'
          )}
        >
          {values.length === 0 ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            <span className="text-ink">
              {values.length} selected: {values.map(v => options.find(o => o.value === v)?.label).filter(Boolean).join(', ')}
            </span>
          )}
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              <div className="max-h-60 overflow-auto p-2">
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={values.includes(option.value)}
                      onChange={() => toggleOption(option.value)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-ink">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

