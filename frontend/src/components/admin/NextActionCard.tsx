import React from 'react';

interface NextActionCardProps {
  taskTitle: string;
  dueTime: string;
  onClick: () => void;
}

export default function NextActionCard({ taskTitle, dueTime, onClick }: NextActionCardProps) {
  return (
    <div className="card-base card-content mt-sp-3 cursor-pointer" onClick={onClick}>
      <h3 className="text-fs-3 font-semibold">{taskTitle}</h3>
      <p className="text-fs-1 text-gray-600">{dueTime}</p>
    </div>
  );
}
