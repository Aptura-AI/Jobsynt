import React from 'react';
import clsx from 'clsx';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

const Textarea: React.FC<TextareaProps> = ({ label, error, className, ...props }) => {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label && <span>{label}</span>}
      <textarea
        className={clsx(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
};

export default Textarea;

