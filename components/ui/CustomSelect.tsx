import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps<T extends string> {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  getDisplayClasses: (value: T) => string;
}

const CustomSelect = <T extends string>({ value, options, onChange, getDisplayClasses }: CustomSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);

  const handleSelect = (option: T) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={ref} onPointerUp={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`font-semibold py-1 px-3 rounded-full text-xs text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#232733] focus:ring-[#3B82F6] transition-colors w-28 ${getDisplayClasses(value)}`}
      >
        {value}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[#2A2F3B] rounded-md shadow-lg border border-gray-700/50">
          <ul className="py-1">
            {options.map((option) => (
              <li
                key={option}
                onClick={() => handleSelect(option)}
                className={`px-3 py-2 text-sm text-white hover:bg-[#3B82F6] cursor-pointer ${option === value ? 'font-bold' : ''}`}
              >
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;