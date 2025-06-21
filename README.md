# Edgar's Mobile Auto Shop

This project contains a simple Express API and React frontend for a mobile auto repair service.

## Backend

1. Copy `.env.example` to `.env` inside `mobile-auto-shop/backend` and adjust values if needed.
2. Install dependencies and start the server:

```bash
cd mobile-auto-shop/backend
npm install
npm start
```

The API expects a PostgreSQL database configured per `docker-compose.yml`.

## API Endpoints

- `GET /services` – list available services
- `POST /services` – create a service
- `GET /customers` – list customers
- `POST /customers` – create a customer
- `GET /appointments` – list appointments
- `POST /appointments` – create an appointment
