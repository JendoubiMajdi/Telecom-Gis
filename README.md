Telecom-Gis
📋 Project Overview
A web-based Geographic Information System (GIS) platform for managing telecom infrastructure.

✅ What's Working Now
User Authentication System with PostgreSQL database

Login/Register pages with form validation

Two-Factor Authentication (2FA) with email OTP verification

Password Reset flow with secure email links

Protected Dashboard with role-based access

JWT Token-based authentication with account lockout protection

Dark Mode theme support across all pages

PostgreSQL Database with users, OTP codes, and password reset tables

🚀 New Features Added
2FA Verification - 6-digit OTP codes via email (Mailtrap)

Forgot/Reset Password - Secure token-based password recovery

Account Security - 5 failed attempts = 15min lockout

Professional Footer - Telcotec company info, map, services

Company Logo - Telcotec branding across platform

Email Service - Mailtrap integration for development emails

🛠️ Tech Stack
Frontend: React, TypeScript, CSS Modules

Backend: Node.js, Express, TypeScript

Database: PostgreSQL

📁 Project Structure
Telecom-Gis/
├── telecom-frontend/     # React + TypeScript
│   ├── src/
│   │   ├── components/  # Navbar, Footer, PrivateRoute
│   │   ├── pages/       # Login, Register, Dashboard, Profile,
│   │   │               # OTPVerification, ForgotPassword, ResetPassword
│   │   ├── context/     # AuthContext, ThemeContext
│   │   └── services/    # auth.service.ts
│   └── public/          # Telcotec logo, favicon
│
└── telecom-backend/     # Node.js + Express
    ├── src/
    │   ├── controllers/ # auth.controller.ts
    │   ├── services/    # user.service.ts, emailService.ts
    │   ├── models/      # User.ts, JwtPayload.ts
    │   ├── routes/      # auth.routes.ts
    │   ├── middleware/  # auth.middleware.ts
    │   ├── utils/       # jwt.ts, password.ts
    │   └── db/          # database.ts
    └── .env            # Config (DB, JWT, Mailtrap)

    🚦 Getting Started
1. Backend Setup
2. cd telecom-backend
npm install
cp .env.example .env   # Update with your credentials
npm run dev

3. Frontend Setup
4. cd telecom-frontend
npm install
npm start

🔑 Environment Variables (.env)
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/telecom_gis

# JWT
JWT_SECRET=your_secret_key

# Email (Mailtrap)
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your_user
EMAIL_PASS=your_pass

👨‍💻 Author
Majdi Jendoubi - PFE Project 2026
Authentication: JWT, bcrypt, crypto

Email: Nodemailer + Mailtrap
