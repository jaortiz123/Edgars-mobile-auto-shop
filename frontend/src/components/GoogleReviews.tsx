import React from 'react';

// Simulated Google Reviews widget for trust bar
const reviews = [
  {
    name: 'Jessica R.',
    rating: 5,
    text: 'Edgar fixed my car in my driveway! Fast, honest, and so convenient. Highly recommend for anyone in Woodland!'
  },
  {
    name: 'Mike D.',
    rating: 5,
    text: 'Showed up on time, explained everything, and saved me money. Best mobile mechanic in Davis.'
  },
  {
    name: 'Samantha P.',
    rating: 5,
    text: 'Super friendly, professional, and local. Will use again!'
  }
];

function Star() {
  return <svg className="inline h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.175 0l-3.38 2.455c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>;
}

const GoogleReviews: React.FC = () => {
  // Simulate a random review each render for "live" feel
  const review = reviews[Math.floor(Math.random() * reviews.length)];
  return (
    <div className="flex flex-col items-center bg-white rounded-lg shadow px-4 py-2 border border-gray-200">
      <div className="flex items-center gap-1 mb-1">
        {[...Array(5)].map((_, i) => <Star key={i} />)}
        <span className="ml-2 text-sm font-semibold text-gray-700">5.0</span>
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" className="h-4 w-4 ml-2" />
      </div>
      <div className="text-xs text-gray-600 italic text-center max-w-[180px]">“{review.text}”</div>
      <div className="text-xs text-gray-500 mt-1">- {review.name}</div>
    </div>
  );
};

export default GoogleReviews;
