import React, { useState, useEffect, useRef } from 'react';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [positionClass, setPositionClass] = useState('origin-top-right top-full mt-2');

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
    if (!isOpen && menuRef.current) {
        const triggerRect = menuRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        // Set a threshold for menu height, a 2-item menu is roughly 90px high.
        const menuHeightThreshold = 100;

        if (spaceBelow < menuHeightThreshold && triggerRect.top > menuHeightThreshold) {
            // Not enough space below, but enough above -> open upwards
            setPositionClass('origin-bottom-right bottom-full mb-2');
        } else {
            // Default -> open downwards
            setPositionClass('origin-top-right top-full mt-2');
        }
    }
    setIsOpen(prev => !prev);
  };

  const handleMenuContentInteraction = (e: React.MouseEvent | React.PointerEvent) => {
    // This is the fix. By stopping propagation here, we prevent the event
    // from bubbling up to parent components like the MobileTradeCard,
    // which would incorrectly trigger navigation. We stop both click and pointerup
    // for robustness.
    e.stopPropagation();
    
    // We also want the menu to close after an action is performed.
    // This will be triggered by the `click` event.
    if (e.type === 'click') {
        setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={handleTriggerClick} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div 
          className={`absolute right-0 w-56 bg-[#2A2F3B] rounded-md shadow-lg border border-gray-700/50 z-20 ${positionClass}`}
          onClick={handleMenuContentInteraction}
          onPointerUp={handleMenuContentInteraction}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
