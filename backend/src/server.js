const { Server } = require("socket.io");
const { env } = require("./config/env");
const { prisma } = require("./db/prisma");
const { buildApp } = require("./app");
const { setIO } = require("./sockets/io");

async function start() {
  const app = buildApp();

  try {
    await prisma.$connect();
    await app.listen({ port: env.port, host: "localhost" });

    const io = new Server(app.server, {
      cors: {
        origin: env.frontendOrigin,
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      socket.on("watch-submission", (submissionId) => {
        const id = Number(submissionId);
        if (!Number.isInteger(id)) return;
        socket.join(`submission:${id}`);
      });
    });

    setIO(io);
    app.log.info(`Server running on http://localhost:${env.port}`);
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
