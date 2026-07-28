# HW13 — Full-Stack Integration + Auth

**Week 13 · DSAW · Universidad de La Sabana**

## Objective

Connect the React frontend to the Express + MongoDB backend, implement JWT authentication, and make both user roles work end-to-end.

## Deliverables

### JWT Authentication

```bash
npm install jsonwebtoken bcryptjs
```

Implement:
- `POST /api/auth/register` — creates a user with a hashed password (`bcrypt`)
- `POST /api/auth/login` — verifies credentials, returns a JWT
- `authMiddleware` that verifies the token from the `Authorization: Bearer <token>` header
- At least 1 protected endpoint that returns `401` without a valid token

The token is stored in `localStorage` on the frontend.

### Two user roles

Both roles defined in your project must exist in the database and provide a different experience in the UI:
- Not just a text or color change — different actions, different sections, or different data
- The role is stored in the JWT payload and used in the frontend for conditional rendering

### No mock data

- The frontend makes real fetches to the backend on Vercel
- No hardcoded `data.js` files with arrays — everything comes from the API
- CORS configured in Express for your frontend domain

### `deployment.txt`

```
https://your-frontend.vercel.app
```
(Add the backend URL in the README if it is a separate repo)

## Layer 2

Detect when the JWT expires and automatically redirect the user to login.

## AI Log (`AI-LOG.md`)

- Did you ask AI for the JWT implementation? Do you understand what goes in the payload and why?
- How did you verify that protected endpoints reject requests with no token?

## Deployment

Vercel for both frontend and backend. Set environment variables in the Vercel dashboard.

## Autograding

The pipeline will check:
- ✅ `deployment.txt` with a URL
- ✅ ESLint passes with no errors
- ✅ URL responds
- ✅ JWT auth, 2 roles with different UI, no mock data, CORS configured (reviewed by Claude)

> **Submission rule:** If it is not deployed and public on Vercel, it cannot be graded.
