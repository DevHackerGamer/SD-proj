# SD-proj

This project is a modern web application with a client and server structure. It includes a home page and an admin page.

## Features

- React Router for navigation
- Express.js backend
- SQL Server integration
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
