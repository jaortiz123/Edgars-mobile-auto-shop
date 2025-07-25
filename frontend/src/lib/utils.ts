export const parseDurationToMinutes = (duration: string): number => {
  if (!duration) return 60; // Default to 1 hour if not specified
  const [value, unit] = duration.split(' ');
  const numValue = parseFloat(value);
  if (unit.includes('hour')) {
    return numValue * 60;
  } else if (unit.includes('minute')) {
    return numValue;
  }
  return 60; // Default
};