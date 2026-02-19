# Frontend Integration Checklist

## 1) Environment
- Set backend `.env`:
  - `FRONTEND_ORIGIN=http://localhost:5173` (or your frontend URL)
  - `NODE_ENV=development`
- Start backend:
  - `npm install`
  - `npm run start`

## 2) HTTP Client Setup
- Use `withCredentials: true` for cookie-based refresh token flow.
- Example with axios:

```js
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});
```

## 3) Auth Flow
1. `POST /auth/register` or `POST /auth/login`
2. Store `accessToken` in memory (not localStorage for this MVP).
3. Send `Authorization: Bearer <accessToken>` for protected routes.
4. On `401`, call `POST /auth/refresh` (cookie is sent automatically).
5. Retry original request with new `accessToken`.
6. `POST /auth/logout` on sign-out.

## 4) Core Screens API Mapping
- Problems list page:
  - `GET /problems`
- Problem detail page:
  - `GET /problems/:id`
- Submit code:
  - `POST /submissions`
- Submission status/result:
  - `GET /submissions/:id`
  - `GET /submissions/:id/result`

## 5) Live Verdict Updates (Socket.IO)
- Connect:
  - `io("http://localhost:3000", { withCredentials: true })`
- Subscribe:
  - `socket.emit("watch-submission", submissionId)`
- Listen:
  - `socket.on("submission:update", (payload) => { ... })`

## 6) Testcase Authoring (Admin)
- Create testcase:
  - `POST /problems/:id/testcases`
- View testcases:
  - `GET /problems/:id/testcases`
