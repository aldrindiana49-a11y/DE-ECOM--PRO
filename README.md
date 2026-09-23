# Drin Electronics E-commerce Web Application

A production full-stack e-commerce platform built for Drin Electronics to support real-world online sales, customer accounts, order processing, payments, shipping integrations, inventory workflows, and administrative operations.

## Live Website

https://drinelectronicsph.com/

## Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- REST APIs
- Axios
- CryptoJS
- Sharp
- SheetJS (XLSX)

### Database & Authentication
- Supabase
- PostgreSQL
- Supabase Auth

### Integrations
- Xendit payment gateway
- SPX shipping integration
- Skyro financing integration
- Lalamove delivery integration

### Deployment & DevOps
- Netlify
- Render
- DigitalOcean App Platform
- Git
- GitHub
- GitHub Pull Requests

## Key Engineering Features

- Product browsing and category navigation
- Shopping cart and checkout workflow
- Customer signup, login, profile, and password reset
- Customer order history and order management
- Guest order tracking
- Admin dashboard and administrative workflows
- Customer and admin chat functionality
- Product detail, hot deals, and trending product sections
- Partner program pages
- Academy and learning-related modules
- Server-side order storage and management using Supabase
- Xendit online payment integration
- SPX shipping fee calculation and shipment creation
- Shipping tracking number and waybill workflows
- Skyro financing application workflow and status handling
- Lalamove delivery integration
- Webhook-based payment and shipping status updates
- Stock reservation and stock restoration workflows
- Order cancellation workflows
- Duplicate-order and duplicate-shipment protection
- API timeout and error handling
- Primary and backup backend infrastructure
- Backend failover for selected API operations
- CORS and environment-variable configuration
- SEO support through `robots.txt` and `sitemap.xml`
- Shipping, refund, privacy, cookie, and terms policy pages

## Production Architecture

The application separates the customer-facing frontend from backend services.

- Netlify hosts the frontend application
- Node.js and Express.js provide backend REST API services
- Supabase provides PostgreSQL database services and authentication
- Render operates as the primary backend deployment
- DigitalOcean App Platform provides a secondary backend deployment
- Xendit handles payment processing
- SPX provides shipping and logistics workflows
- Skyro provides financing-related workflows
- Lalamove provides delivery integration

The project was developed and tested against real e-commerce workflows and is used to support actual business operations.

## Problems Solved

During development and production use, I worked on issues involving:

- API timeouts and network routing failures
- CORS configuration and cross-origin requests
- Backend deployment and repository migration
- Payment and shipping API integrations
- Webhook processing
- Duplicate request prevention
- Order status synchronization
- Database updates and inventory restoration
- Backend failover between cloud providers
- Git branching and pull request workflows
- Protected branch rules
- Cloud deployment troubleshooting
- Third-party API error handling

## Project Structure

- `Home/` – main customer-facing e-commerce application
- `Home/Admin/` – administrative dashboard and order management
- `Home/Checkout/` – customer checkout workflow
- `Home/Cart/` – shopping cart
- `Home/Product/` – product detail pages
- `Home/Categories/` – category browsing
- `Home/Home-orders/` – customer order history
- `Home/Homeprofile/` – customer profile
- `Home/guest-track/` – guest order tracking
- `Home/login/` – customer authentication
- `Home/signup/` – customer registration
- `Home/reset-password/` – password recovery
- `Home/chat/` – customer chat
- `Home/Admin-chat/` – admin-side chat
- `Home/Academy/` – academy and learning-related pages
- `Home/Admin-academy/` – academy administration
- `Home/HotDeals/` – promotional products
- `Home/Trending/` – trending products
- `Home/PartnerProgram/` – partner program
- `services/` – backend services and third-party integrations
- `Data/` – project data and supporting files
- `Audio/` – audio-related assets
- `server.js` – main Node.js and Express.js backend server
- `package.json` – project dependencies and scripts
- `netlify.toml` – Netlify deployment configuration

## Backend & API

The backend is built with Node.js and Express.js and provides REST API endpoints for customer orders, checkout workflows, shipping, payments, financing, and administrative operations.

Supabase is used for database services and authentication, while Axios is used for third-party HTTP and API requests.

The backend also handles webhook events, order status updates, inventory workflows, shipment creation, and external service integration.

## Deployment

The project uses multiple cloud platforms:

- Netlify for frontend hosting
- Render for primary backend hosting
- DigitalOcean App Platform for secondary backend hosting

This setup provides flexibility and backup infrastructure for backend services.

## Version Control

Git and GitHub are used for source control and repository management.

Development workflows include:

- Git branches
- Commits
- Pull requests
- Protected branch rules
- Code merging
- Deployment through GitHub-connected cloud services

## What I Learned

This project gave me practical experience building and maintaining a production full-stack web application.

I gained hands-on experience with:

- Frontend development
- Backend API development
- Database operations
- Authentication
- Third-party API integration
- Payment integration
- Shipping and logistics workflows
- Webhook handling
- Cloud deployment
- Git and GitHub workflows
- Production debugging
- Error handling
- Network and CORS troubleshooting
- Real-world e-commerce workflows

## Author

**Aldrin B. Diana**

Junior Full-Stack Web Developer

Live Project: https://drinelectronicsph.com/

LinkedIn: https://www.linkedin.com/in/aldrin-diana-4b73641a7/
