import React from 'react';
import Input from './Input';
import Button from './Button';

type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
};

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder, onSubmit }) => {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="sm:flex-1"
      />
      <Button type="button" variant="primary" onClick={onSubmit}>
        Search
      </Button>
    </div>
  );
};

export default SearchBar;

