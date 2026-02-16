require("dotenv").config();

const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET,
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is required in .env");
}

module.exports = { env };
