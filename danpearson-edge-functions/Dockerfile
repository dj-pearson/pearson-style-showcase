# Dockerfile for danpearson.net Edge Functions
# Self-Hosted Supabase Edge Functions with Deno
#
# BUILD CONTEXT IS THE REPOSITORY ROOT, not this directory.
#   docker build -f danpearson-edge-functions/Dockerfile .
# The function source lives in supabase/functions, which is the single source of
# truth; this directory holds only the runtime that serves it. Building with
# this directory as the context will fail on the COPY below, by design; that is
# what previously allowed a second, drifting copy of every function to exist.

FROM denoland/deno:1.40.0

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create Deno cache directory with proper permissions
RUN mkdir -p /app/.deno_cache && chown deno:deno /app/.deno_cache

# Set Deno cache directory
ENV DENO_DIR=/app/.deno_cache

# Copy the canonical function source
COPY --chown=deno:deno supabase/functions ./functions

# Copy server script
COPY --chown=deno:deno danpearson-edge-functions/server.ts .

# Switch to non-root user for security
USER deno

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost:8000/_health || exit 1

# Start server with necessary permissions
# --allow-net: Network access for HTTP server and external APIs
# --allow-read: Read functions directory
# --allow-env: Access environment variables
# --unstable: Enable Deno unstable APIs
CMD ["deno", "run", \
  "--allow-net", \
  "--allow-read", \
  "--allow-env", \
  "--unstable", \
  "server.ts"]
