Telecom-Gis
📋 Project Overview
A web-based Geographic Information System (GIS) platform for managing telecom infrastructure.

✅ What's Working Now
User Authentication – PostgreSQL + JWT

Login/Register – Form validation

Two-Factor Authentication (2FA) – 6-digit OTP via email

Password Reset – Secure token-based recovery

Role-Based Dashboard – Protected routes

Account Lockout – 5 failed attempts = 15min lock

Dark Mode – Full theme support

Database – Users, OTP codes, password reset tables

🚀 New Features Added
2FA Verification – Email OTP (Mailtrap)

Forgot/Reset Password – Token-based flow

Account Security – Brute force protection

Footer – Telcotec info, map, services

Branding – Telcotec logo + favicon

Email Service – Nodemailer + Mailtrap

🛠️ Tech Stack
Frontend	Backend	Database	Auth/Email
React + TypeScript	Node.js + Express	PostgreSQL	JWT + bcrypt
CSS Modules	TypeScript		crypto + Nodemailer

📁 Project Structure
Telecom-Gis/
│
├── telecom-frontend/
│   ├── public/              # Logo, favicon
│   └── src/
│       ├── components/      # Navbar, Footer, PrivateRoute
│       ├── pages/           # Login, Register, Dashboard, Profile,
│       │                   # OTPVerification, ForgotPassword, ResetPassword
│       ├── context/         # AuthContext, ThemeContext
│       └── services/        # auth.service.ts
│
└── telecom-backend/
    ├── src/
    │   ├── controllers/     # auth.controller.ts
    │   ├── services/        # user.service.ts, emailService.ts
    │   ├── models/          # User.ts, JwtPayload.ts
    │   ├── routes/          # auth.routes.ts
    │   ├── middleware/      # auth.middleware.ts
    │   ├── utils/           # jwt.ts, password.ts
    │   └── db/              # database.ts
    └── .env                 # Configuration

    🚦 Getting Started
1. Backend
   cd telecom-backend
    npm install
    cp .env.example .env
    npm run dev

2. Frontend
    cd telecom-frontend
    npm install
    npm start

🔑 Environment Variables (.env)
    # Database
DATABASE_URL=postgresql://user:pass@localhost:5432/telecom_gis

# JWT
JWT_SECRET=your_secret_key

# Mailtrap
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your_user
EMAIL_PASS=your_pass


👨‍💻 Author
Majdi Jendoubi – PFE Project 2026
