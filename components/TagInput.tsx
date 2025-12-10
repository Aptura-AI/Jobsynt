import React, { useState } from 'react';
import Button from './Button';

type TagInputProps = {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

const TagInput: React.FC<TagInputProps> = ({ label, values, onChange, placeholder }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const value = input.trim();
    if (!value) return;
    if (values.includes(value)) {
      setInput('');
      return;
    }
    onChange([...values, value]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {values.map((tag) => (
          <span key={tag} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
            {tag}
            <button className="text-muted hover:text-ink" type="button" onClick={() => removeTag(tag)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder || 'Add a skill and press Enter'}
          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
        />
        <Button type="button" variant="ghost" onClick={addTag}>
          Add
        </Button>
      </div>
    </div>
  );
};

export default TagInput;

