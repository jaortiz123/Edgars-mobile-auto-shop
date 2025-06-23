const jwt = require('jsonwebtoken');

function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

module.exports = function (req, res, next) {
  const cookieToken = getCookie(req, 'authToken');
  const headerToken = req.headers['authorization']?.split(' ')[1];
  const token = cookieToken || headerToken;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};
