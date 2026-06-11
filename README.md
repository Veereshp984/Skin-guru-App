# SkinGuru AI

SkinGuru AI is an advanced, AI-powered healthcare platform designed to assist in the early detection and management of skin diseases. It bridges the gap between artificial intelligence and clinical oversight, empowering patients to scan skin lesions and dermatologists to review AI predictions in a seamless, secure environment.

## 🚀 Live Demo

- **Frontend Application**: [https://skin-guru-app.onrender.com](https://skin-guru-app.onrender.com)
- **Backend API**: [https://skin-guru-api.onrender.com](https://skin-guru-api.onrender.com)

---

## 🌟 Key Features

### 1. Role-Based Workflows
The platform is built with strict Role-Based Access Control (RBAC), offering specialized portals for different user types:
- **Patients**: Can upload or take live webcam photos of skin lesions, view AI-generated predictions with confidence scores, submit cases for professional review, and track their personal health analytics.
- **Doctors / Dermatologists**: Have access to a dedicated Clinical Studio to claim pending patient reviews, analyze high-resolution images, provide medical notes, prescribe care instructions, and officially sign-off on AI predictions.
- **Administrators**: Have bird's-eye view access to the platform's performance, including API health, system traffic, registered user demographics, and AI model usage metrics.

### 2. AI Skin Disease Detection
Utilizes deep learning models (served via FastAPI) to instantly analyze skin images and predict conditions such as Melanoma, Basal Cell Carcinoma, Actinic Keratosis, and more.

### 3. Comprehensive Analytics Dashboards
Built using `recharts`, each role has access to dynamic, real-time analytics:
- **Patient Dashboard**: Tracks historical scanning activity, common predictions, and clinical review statuses.
- **Doctor Dashboard**: Monitors clinical workload, average turnaround times, and diagnosis distributions.
- **Admin Dashboard**: Visualizes overall system health, total scan trends, and AI model prediction confidence averages.

### 4. Secure Authentication
Employs robust security mechanisms:
- Short-lived JWT (JSON Web Token) access tokens.
- Secure, HTTP-Only refresh cookies.
- BCrypt password hashing and structured MongoDB indexing.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React.js (via Vite)
- **Styling**: Tailwind CSS (via custom configuration for a dynamic, premium aesthetic)
- **Routing**: React Router DOM
- **Data Visualization**: Recharts

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (motor asynchronous driver)
- **Authentication**: PyJWT, passlib
- **Machine Learning**: TensorFlow / Keras (or equivalent inference engine depending on configuration)

---

## 💻 Local Development

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB instance (local or Atlas)

### Backend Setup
1. Navigate to the root directory.
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up your `.env` file with your MongoDB URI and JWT secrets.
4. Run the FastAPI development server:
   ```bash
   python -m uvicorn backend.app.main:app --reload
   ```
   The API will be available at `http://127.0.0.1:8000`.

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The web app will be available at `http://localhost:5173`.

---

## 🛡️ Privacy & Compliance
SkinGuru AI emphasizes data privacy. Patient data is heavily partitioned, meaning users can only access their own scans, and Doctors can only access cases assigned to them or left in the general pending queue. API requests are verified through secure middleware to prevent unauthorized access.
