# Edgar's Mobile Auto Shop

This project contains a simple Express API and React frontend for a mobile auto repair service.

## Quick Start

1. Install **Node.js 18**, **Docker**, and **docker-compose**.
2. Copy environment examples:

   ```bash
   cp mobile-auto-shop/backend/.env.example mobile-auto-shop/backend/.env
   cp mobile-auto-shop/frontend/.env.example mobile-auto-shop/frontend/.env
   ```

3. Install dependencies:

   ```bash
   npm install
   npm --prefix mobile-auto-shop/backend install
   npm --prefix mobile-auto-shop/frontend install
   ```

4. Start the stack:

   ```bash
   docker-compose -f mobile-auto-shop/docker-compose.yml up --build
   ```

5. Run tests:

   ```bash
   npm --prefix mobile-auto-shop/backend test
   npm --prefix mobile-auto-shop/frontend test -- --run
   npm test         # executes Playwright E2E suite
   ```

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

## Infrastructure & Deployment

Terraform files in `infra/terraform` create the AWS infrastructure including VPC, ECS, RDS, ALB, S3 and CloudFront. GitHub Actions workflows build and deploy the backend to ECS and the frontend to S3/CloudFront.

To provision the infrastructure:

```bash
cd infra/terraform
terraform init
terraform apply -var="backend_image=<ECR image URI>" -var="db_username=<user>" -var="db_password=<pass>"
```

Workflows expect AWS credentials and resource names stored in repository secrets.

## Launch Plan

Detailed cutover steps are available in [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md). Review the document prior to switching DNS to production endpoints.

## Testing and Optimization

Sample load test configuration is provided in `scripts/load-test.yaml`.
Run it using Artillery:

```bash
npx artillery run scripts/load-test.yaml
```

Security review steps are in `docs/SECURITY_CHECKLIST.md`.
