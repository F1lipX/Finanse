const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ msg: 'Brak tokenu' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'tajnyJWTklucz123');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ msg: 'Nieprawidłowy token' });
  }
};
