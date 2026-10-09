# Jump HQ Cloud: the hosted version (gateway + one private Jump HQ per customer).
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# The agents are Claude Code sessions; on the server they run on the platform's ANTHROPIC_API_KEY.
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /app/cloud-data /app/workspace && chown -R node:node /app
USER node
ENV NODE_ENV=production CLAUDE_BIN=claude CLOUD_DATA=/app/cloud-data
EXPOSE 8080
CMD ["node", "server/cloud.js"]
