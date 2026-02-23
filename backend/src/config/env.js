require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 3000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV || "development",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  codeforcesHandle: process.env.CODEFORCES_HANDLE || "",
  codeforcesHandleOrEmail:
    process.env.CODEFORCES_HANDLE_OR_EMAIL || process.env.CODEFORCES_HANDLE || "",
  codeforcesPassword: process.env.CODEFORCES_PASSWORD || "",
  codeforcesCookie: process.env.CODEFORCES_COOKIE || "",
};

if (!env.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET (or JWT_SECRET) is required in .env");
}

if (!env.jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET is required in .env");
}

module.exports = { env };
