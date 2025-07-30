# Edgar's Mobile Auto Repair Hub

This repository contains the serverless backend for "Edgar's Mobile Auto Repair Hub," a conversational AI system for generating service quotes. The project is built entirely on AWS and managed via Terraform, demonstrating modern cloud architecture and DevOps practices.

## Core Technologies

-   **Cloud Provider:** AWS
-   **Compute:** AWS Lambda (Python)
-   **API:** Amazon API Gateway (HTTP API)
-   **Database:** Amazon DynamoDB
-   **Conversational AI:** Amazon Lex (planned integration)
-   **Infrastructure as Code:** Terraform
-   **CI/CD:** GitHub Actions

## UI Standards

For information on the design system, including typography and spacing, please see the [UI Standards documentation](docs/UI-Standards.md).

---

## Architecture

The system is designed as a serverless, event-driven architecture. The initial implementation provides a core RESTful API for quote generation.

```mermaid
graph TD
    subgraph "User Interaction"
        Client[Web/Mobile Client]
    end

    subgraph "AWS Cloud"
        API_GW[API Gateway: POST /quote]
        Lambda[Lambda: QuoteFunction]
        DDB[DynamoDB: EdgarQuotes Table]
    end

    Client -- HTTPS Request --> API_GW
    API_GW -- Invokes --> Lambda
    Lambda -- Writes to --> DDB