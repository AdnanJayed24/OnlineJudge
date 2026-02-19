const IORedis = require("ioredis");
const { env } = require("../config/env");

let connection;

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

async function closeRedisConnection() {
  if (!connection) return;
  await connection.quit();
  connection = null;
}

module.exports = {
  getRedisConnection,
  closeRedisConnection,
};
