# Stage 1: Build Stage (Install all dependencies, build client)
FROM node:20-alpine AS builder
WORKDIR /app

# Install OS build dependencies needed for some npm packages (like mssql)
RUN apk add --no-cache python3 make g++ unixodbc-dev

# Copy package files
COPY ../../package.json ../../package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# --- Add this section for debugging Clerk versions ---
RUN echo "--- [Builder] Checking Clerk versions ---" && \
    npm ls @clerk/clerk-react || echo "--- [Builder] @clerk/clerk-react not found or ls failed ---" && \
    npm ls @clerk/shared || echo "--- [Builder] @clerk/shared not found or ls failed ---"
# --- End debugging section ---

# Copy config files first for better caching if only code changes
COPY ../../tsconfig.json ../../tsconfig.base.json ./
COPY ../../vite.config.ts ./
COPY ../../tailwind.config.js ./
# If you have postcss.config.js, uncomment the line below
# COPY ../../postcss.config.js ./

# Copy .env files BEFORE build to make VITE_ variables available
COPY ../../.env* ./

# Copy the rest of the application code
COPY ../../client ./client
COPY ../../server ./server
COPY ../../shared ./shared

# Run the build script defined in package.json
# This should generate output in /app/build/client based on vite.config.ts
RUN npm run build

# --- Add this section for debugging ---
# List the build output to verify structure
RUN echo "--- Listing build output ---" && \
    ls -l /app/build && \
    ls -l /app/build/client && \
    ls -l /app/build/client/assets || echo "--- Failed to list assets (maybe directory doesn't exist?) ---"
# --- End debugging section ---

# Stage 2: Production Stage (Install only production dependencies, copy build artifacts)
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime OS dependencies (like unixodbc for mssql)
RUN apk add --no-cache unixodbc

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package files
COPY ../../package.json ../../package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# --- Add this section for debugging Clerk versions ---
RUN echo "--- [Runner] Checking Clerk versions ---" && \
    npm ls @clerk/clerk-react || echo "--- [Runner] @clerk/clerk-react not found or ls failed ---" && \
    npm ls @clerk/shared || echo "--- [Runner] @clerk/shared not found or ls failed ---"
# --- End debugging section ---

# Copy built client from the builder stage
COPY --from=builder /app/build ./build

# Copy server source code and shared code needed for runtime
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Expose the port the app runs on (server.js uses PORT or 5000)
# Azure App Service will set the PORT environment variable automatically
EXPOSE 5000

# Command to run the application
CMD ["node", "server/src/server.js"]
