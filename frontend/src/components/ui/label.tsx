import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export const Label: React.FC<LabelProps> = ({ 
  children, 
  className = '',
  ...props 
}) => {
  return (
    <label 
      className={`block text-sm font-medium text-gray-300 mb-2 ${className}`.trim()}
      {...props}
    >
      {children}
    </label>
  );
};

export default Label; 