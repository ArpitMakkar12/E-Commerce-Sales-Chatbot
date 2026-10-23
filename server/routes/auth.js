// /api/auth/register, /api/auth/login, /api/auth/me
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { signToken } from '../middleware/auth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compared against when the email doesn't exist, so a wrong email and a
// wrong password take the same time (doesn't reveal which emails exist).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

export function toPublicUser(user) {
  return { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

function readText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createAuthRouter(store, requireAuth) {
  const router = Router();

  router.post('/register', authLimiter, async (req, res) => {
    const email = readText(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const firstName = readText(req.body?.firstName);
    const lastName = readText(req.body?.lastName);

    let error = null;
    if (!firstName || firstName.length > 50) error = 'Please enter your first name (up to 50 characters).';
    else if (!lastName || lastName.length > 50) error = 'Please enter your last name (up to 50 characters).';
    else if (!EMAIL_PATTERN.test(email) || email.length > 254) error = 'Please enter a valid email address.';
    else if (password.length < 6 || password.length > 72) error = 'Password must be 6 to 72 characters long.';
    if (error) return res.status(400).json({ error });

    const user = {
      _id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    };

    try {
      await store.users.create(user);
    } catch (err) {
      if (err.code === 'DUPLICATE_EMAIL') return res.status(409).json({ error: err.message });
      throw err;
    }

    res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const email = readText(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password.' });
    }

    const user = await store.users.findByEmail(email);
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.json({ token: signToken(user), user: toPublicUser(user) });
  });

  // Lets the frontend check that a saved token is still valid.
  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  return router;
}