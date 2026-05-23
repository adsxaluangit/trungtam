/**
 * Robustly parses and formats dates to dd/mm/yyyy
 * Handles formats: YYYY-MM-DD, DD,MM,YYYY, DD/MM/YYYY, and Date objects
 */
export const formatDate = (dateInput: any): string => {
  if (!dateInput) return '--';

  let date: Date | null = null;

  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    if (!s) return '--';

    // Handle DD,MM,YYYY (from Registration form)
    const commaMatch = s.match(/^(\d{1,2}),(\d{1,2}),(\d{4})$/);
    if (commaMatch) {
      date = new Date(Number(commaMatch[3]), Number(commaMatch[2]) - 1, Number(commaMatch[1]));
    } 
    // Handle DD/MM/YYYY
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split('/');
      date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    // Handle YYYY-MM-DD (ISO)
    else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      date = new Date(s);
    }
    // Fallback for other standard strings
    else {
      date = new Date(s);
    }
  }

  if (!date || isNaN(date.getTime())) return dateInput || '--';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Parses various date formats to ISO YYYY-MM-DD for backend storage
 */
export const parseToISO = (dateInput: any): string => {
  if (!dateInput) return '';
  
  if (dateInput instanceof Date) {
    return dateInput.toISOString().split('T')[0];
  }

  const s = String(dateInput).trim();
  
  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;

  // DD,MM,YYYY
  const commaMatch = s.match(/^(\d{1,2}),(\d{1,2}),(\d{4})$/);
  if (commaMatch) return `${commaMatch[3]}-${commaMatch[2].padStart(2, '0')}-${commaMatch[1].padStart(2, '0')}`;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return s;
};
