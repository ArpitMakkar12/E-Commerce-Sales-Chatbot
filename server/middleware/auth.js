// Login tokens (JWT): create one at sign-in, check it on protected routes.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(user) {
  return jwt.sign({ sub: user._id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Returns a middleware that rejects requests without a valid token and
// puts the signed-in user on req.user for the route handlers.
export function createRequireAuth(store) {
  return async function requireAuth(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    const user = await store.users.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Your account was not found. Please sign in again.' });
    }

    req.user = user;
    next();
  };
}