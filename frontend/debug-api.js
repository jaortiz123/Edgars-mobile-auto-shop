// Quick debug script to test the api function
import { getBoard } from './src/lib/api.ts';

console.log('Starting debug...');
console.log('getBoard function:', getBoard);
console.log('getBoard toString:', getBoard.toString().substring(0, 300));

try {
  const result = await getBoard({});
  console.log('getBoard result:', result);
} catch (error) {
  console.error('getBoard error:', error);
}
