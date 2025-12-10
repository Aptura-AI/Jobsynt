import React from 'react';
import clsx from 'clsx';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

const Select: React.FC<SelectProps> = ({ label, error, className, children, ...props }) => {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label && <span>{label}</span>}
      <select
        className={clsx(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
};

export default Select;

