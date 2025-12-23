# AssetVerse — Server Application

The dedicated backend API for the **AssetVerse Asset Management System**.  
This server-side application handles data persistence, authentication security, payment processing, and complex business logic to support the frontend client.

---

## Project Overview

The **AssetVerse Server** acts as the central logic hub of the platform.  
It connects the React frontend with a MongoDB database, ensuring secure and scalable data handling for both HR administrators and employees.

Key responsibilities include:
- JWT-based authentication and authorization
- Stripe payment intent generation
- Asset and request lifecycle management
- Aggregation pipelines for analytical dashboards

---

## Key Features

### Core Infrastructure
- **RESTful API Architecture**  
  Cleanly organized endpoints for users, assets, requests, and team management.
- **Secure Authentication**  
  JSON Web Tokens (JWT) for stateless authentication and protected routes.
- **Role-Based Access Control (RBAC)**  
  Middleware to verify HR and Employee roles and restrict sensitive endpoints.

### Business Logic
- **Asset Lifecycle Management**  
  Handles asset creation, inventory updates (increment/decrement), and deletion.
- **Request Processing**  
  Validation logic for approving, rejecting, and returning asset requests, including subscription-based team limits.
- **Payment Integration**  
  Secure communication with Stripe to generate payment intents for plan upgrades.
- **Analytics Engine**  
  MongoDB aggregation pipelines to compute HR dashboard statistics (top requested items, asset type distribution, etc.).

---

## Tech Stack

- **Runtime Environment:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Native Driver)
- **Authentication:** JSON Web Tokens (JWT)
- **Payments:** Stripe API
- **Utilities:** Cors, Dotenv

---

## API Endpoints

### Authentication
- `POST /jwt`  
  Issues access tokens after successful authentication.
- `POST /users`  
  Registers a new user in the database.

### Assets & Requests
- `GET /assets`  
  Retrieves all assets (supports search, sort, and pagination).
- `POST /assets`  
  Adds a new asset to the inventory.
- `POST /requests`  
  Submits a new asset request.
- `GET /requests`  
  Retrieves requests filtered by email or search parameters.
- `PATCH /requests/:id`  
  Updates request status (Approve / Reject / Return) and adjusts asset stock.

### HR Management
- `GET /hr-stats/:email`  
  Returns aggregated data for HR dashboard charts.
- `GET /my-team/:email`  
  Retrieves the list of employees affiliated with an HR manager.
- `PATCH /users/upgrade`  
  Updates user subscription limits after successful payment.

### Payments
- `POST /create-payment-intent`  
  Generates a Stripe client secret for secure transactions.

---

## Local Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB Atlas account

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-username/asset-verse-server.git
cd asset-verse-server
````

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**
   Create a `.env` file in the root directory:

```env
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
ACCESS_TOKEN_SECRET=your_jwt_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key
PORT=5000
```

4. **Run the server**

```bash
# Development (with nodemon)
npm run start

# Standard start
node index.js
```

The server will run at:
`http://localhost:5000`

---

## Deployment Notes

This backend is optimized for **Vercel** and similar serverless platforms.

### Vercel Deployment

* Add all environment variables (`DB_USER`, `DB_PASS`, `ACCESS_TOKEN_SECRET`, etc.) in the Vercel dashboard.
* Include a `vercel.json` file if route rewriting is required.
* In MongoDB Atlas, allow network access from:

```
0.0.0.0/0
```

to support Vercel’s dynamic IP addresses.

---

## License

This project is licensed under the **MIT License**.

---
