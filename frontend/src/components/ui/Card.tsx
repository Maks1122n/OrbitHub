import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx(
      'bg-gray-800 border border-gray-700 rounded-lg shadow-lg',
      className
    )}>
      {children}
    </div>
  );
}; 