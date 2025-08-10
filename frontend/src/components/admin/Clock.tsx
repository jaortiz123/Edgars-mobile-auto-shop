import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000); // tick ~every 15s
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-2xl font-semibold text-gray-700 tabular-nums">{format(now, 'h:mm a')}</span>
  );
}
