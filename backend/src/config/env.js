require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 3000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
};

if (!env.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET (or JWT_SECRET) is required in .env");
}

if (!env.jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET is required in .env");
}

module.exports = { env };
