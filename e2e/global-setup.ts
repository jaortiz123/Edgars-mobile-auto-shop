import axios from 'axios';
export default async function globalSetup() {
  await axios.post('http://localhost:5001/debug/reset-db');
}
