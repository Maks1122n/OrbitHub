import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md'
}) => {
  const variants = {
    default: 'bg-gray-600 text-gray-100',
    success: 'bg-success/20 text-success border border-success/30',
    danger: 'bg-danger/20 text-danger border border-danger/30',
    warning: 'bg-warning/20 text-warning border border-warning/30',
    info: 'bg-primary/20 text-primary border border-primary/30'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}; 