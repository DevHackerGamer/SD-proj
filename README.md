# SD-proj

This project is a modern web application with a client and server structure. It includes a home page and an admin page.

## Features

- React Router for navigation
- Express.js backend
- SQL Server integration
- **Azure Blob Storage for file uploads**
- Dockerized for easy deployment

## File Structure

```
- client/
  - src/
    - layouts/
      - RootLayout.tsx
    - pages/
      - AdminPage.tsx
      - HomePage.tsx
    - main.tsx
    - styles/
      - index.css
  - index.html
  - vite.config.ts
- server/
  - src/
    - config/
      - database.js
    - middleware/
      - errorHandles.js
      - logging.js
    - routes/
      - clerkWebhookRoutes.js
      - uploadRoutes.js
    - server.js
- shared/
  - types/
    - example.ts
  - validation/
    - exampleSchema.js
- docker/
  - sprint1/
    - Dockerfile
    - .dockerignore
- package.json
- tsconfig.base.json
- tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js and npm
- Docker (optional, for containerized deployment)
- **Azure Account with Blob Storage:** You need an Azure Storage account and a container configured. Obtain the connection string.

### Environment Variables

Create a `.env` file in the project root and add the following variables:

```dotenv
# Server Configuration
PORT=5000

# Clerk Authentication (replace with your actual keys)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Azure Blob Storage Configuration (replace with your actual values)
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=your_storage_account_name;AccountKey=your_account_key;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="your_container_name" # e.g., uploads

# Optional: CI/CD Trigger URL for Clerk Webhooks
# CI_TRIGGER_URL=https://your-ci-cd-pipeline-trigger-url
```

**Important:** Add `.env` to your `.gitignore` file to avoid committing secrets.

### Installation

Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

### Production

Build the project:

```bash
npm run build
```

Run the production server:

```bash
npm start
```

### Docker Deployment

Build and run the Docker container:

```bash
docker build -t sd-proj .
docker run -p 3000:3000 sd-proj
```

**Note on Docker and Environment Variables:** When deploying with Docker, especially to services like Azure App Service, ensure the environment variables (like `AZURE_STORAGE_CONNECTION_STRING`, `CLERK_SECRET_KEY`, etc.) are configured in the App Service Application Settings. They will override any values baked into the image or `.env` file within the container.
