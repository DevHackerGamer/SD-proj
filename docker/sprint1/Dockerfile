# Stage 1: Build Stage (Install all dependencies, build client)
FROM node:20-slim AS builder
WORKDIR /app

# Install OS build dependencies needed for ONNX Runtime and other packages
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    unixodbc-dev \
    libgomp1 \
    curl

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# --- Add this section for debugging Clerk versions ---
RUN echo "--- [Builder] Checking Clerk versions ---" && \
    npm ls @clerk/clerk-react || echo "--- [Builder] @clerk/clerk-react not found or ls failed ---" && \
    npm ls @clerk/shared || echo "--- [Builder] @clerk/shared not found or ls failed ---"
# --- End debugging section ---

# Copy config files first for better caching if only code changes
COPY tsconfig.json tsconfig.base.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
# If you have postcss.config.js, uncomment the line below
# COPY postcss.config.js ./

# Temporarily modify tsconfig to fix build issues
RUN if grep -q "verbatimModuleSyntax" tsconfig.json; then \
    sed -i 's/"verbatimModuleSyntax": true/"verbatimModuleSyntax": false/g' tsconfig.json; \
    fi

# Copy .env files BEFORE build to make VITE_ variables available
COPY .env* ./

# Copy the rest of the application code
COPY client ./client
COPY server ./server
COPY shared ./shared

# Run the build script defined in package.json
RUN npm run build

# Stage 2: Production Stage
FROM node:20-slim AS runner
WORKDIR /app

# Install runtime OS dependencies for ONNX Runtime and sharp
RUN apt-get update && apt-get install -y \
    unixodbc \
    libgomp1 \
    ca-certificates \
    libvips-dev

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Rebuild sharp for the target platform
RUN npm rebuild sharp --platform=linux --arch=x64

# Install missing Azure packages explicitly
RUN npm install @azure/ai-form-recognizer @azure/ai-text-analytics mammoth

# Copy built client from the builder stage
COPY --from=builder /app/build ./build

# Copy server source code and shared code needed for runtime
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["node", "server/src/server.js"]