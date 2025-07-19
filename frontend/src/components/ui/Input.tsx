import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input: React.FC<InputProps> = ({ 
  className, 
  error, 
  ...props 
}) => {
  return (
    <input
      className={clsx(
        'w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'transition-colors duration-200',
        error && 'border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    />
  );
}; 