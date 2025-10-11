import React, { useState, useEffect, useRef } from 'react';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerClick = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 origin-top-right bg-[#2A2F3B] rounded-md shadow-lg border border-gray-700/50 z-20"
          onClick={() => setIsOpen(false)} // Close menu on item click
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
