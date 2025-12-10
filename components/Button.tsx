import clsx from 'clsx';
import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
};

const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', loading, ...props }) => {
  return (
    <button
      className={clsx(
        'btn',
        variant === 'primary' ? 'btn-primary' : 'btn-ghost',
        loading && 'opacity-80',
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};

export default Button;

