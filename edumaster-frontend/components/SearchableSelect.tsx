import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';

export interface Option {
  id: string;
  label: string;
  data?: any;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string, option: Option | null) => void;
  fetchOptions: (search: string) => Promise<Option[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  initialOptions?: Option[];
  defaultLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  fetchOptions,
  placeholder = 'Chọn...',
  disabled = false,
  className = '',
  initialOptions = [],
  defaultLabel = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);

  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Update label if options contain the value
  useEffect(() => {
    if (value) {
      const opt = options.find(o => String(o.id) === String(value));
      if (opt) {
        setSelectedLabel(opt.label);
      }
    } else {
      setSelectedLabel('');
    }
  }, [value, options]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchOptions(search);
        setOptions(results);
      } catch (err) {
        console.error('Fetch options failed', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, isOpen]);

  const handleSelect = (opt: Option) => {
    setSelectedLabel(opt.label);
    setSearch('');
    setIsOpen(false);
    onChange(opt.id, opt);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-2 bg-white border rounded-md shadow-sm cursor-pointer 
          ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'hover:bg-gray-50 border-gray-300 focus-within:ring-1 focus-within:ring-indigo-500'}
        `}
      >
        <span className="truncate block text-sm">
          {selectedLabel || <span className="text-gray-400">{placeholder}</span>}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg top-full max-h-60 overflow-hidden flex flex-col">
          <div className="flex items-center px-3 py-2 border-b border-gray-100 sticky top-0 bg-white">
            <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              className="w-full focus:outline-none text-sm"
              placeholder="Gõ để tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
          </div>
          <div className="overflow-y-auto max-h-48">
            {options.length === 0 && !isLoading ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">Không tìm thấy kết quả</div>
            ) : (
              options.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50
                    ${String(value) === String(opt.id) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}
                  `}
                >
                  <Check className={`w-4 h-4 mr-2 flex-shrink-0 ${String(value) === String(opt.id) ? 'opacity-100 text-indigo-600' : 'opacity-0'}`} />
                  <span className="truncate">{opt.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
