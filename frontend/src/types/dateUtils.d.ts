declare module '@/utils/dateUtils' {
  export function formatDate(date: string | number | Date, format?: 'date' | 'time' | 'dateTime' | 'dayName' | 'shortDate'): string;
}
