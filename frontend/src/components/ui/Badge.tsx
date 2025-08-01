import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' | 'primary';
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children, ...props }) => {
  const baseClasses = 'inline-flex items-center rounded-full px-sp-2 py-sp-1 text-fs-0 font-semibold';
  
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    primary: 'bg-blue-500 text-blue-900',
    secondary: 'bg-gray-100 text-gray-800',
    destructive: 'bg-red-100 text-red-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-orange-100 text-orange-800',
    outline: 'border border-gray-300 text-gray-700'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export { Badge };
