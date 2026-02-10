# Smart Hospital Management System - Backend Setup

A complete Express.js backend for the Smart Hospital Management System with full API integration.

## 📋 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Patient Management**: Register, search, and manage patient records
- **Doctor Module**: Prescriptions, appointments, lab & radiology requests, referrals
- **Pharmacy**: Prescription dispensing and inventory management
- **Laboratory**: Lab test requests and results management
- **Radiology**: Radiology requests and report management
- **Nursing**: Patient vitals recording and care notes
- **Billing**: Invoice generation and payment management
- **Inventory**: Stock management and low-stock alerts
- **Admin Dashboard**: System statistics, activity logs, and reports
- **Queue Management**: Patient queue display system

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** (optional)
   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_change_in_production
   JWT_EXPIRE=7d
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the backend server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## 🔑 Test Credentials

Use these credentials to test the system:

### Admin
- Email: `admin@smarthospital.com`
- Password: `password123`
- Role: `admin`

### Doctor
- Email: `ahmad@smarthospital.com`
- Password: `password123`
- Role: `doctor`

### Receptionist
- Email: `reception@smarthospital.com`
- Password: `password123`
- Role: `receptionist`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/verify-token` - Token verification

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:userId` - Get user details
- `PUT /api/users/profile/:userId` - Update user profile
- `DELETE /api/users/:userId` - Delete user (admin only)

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:patientId` - Get patient details
- `GET /api/patients/search/query?q=query` - Search patients
- `POST /api/patients` - Register new patient
- `PUT /api/patients/:patientId` - Update patient

### Prescriptions
- `GET /api/prescriptions` - Get all prescriptions
- `GET /api/prescriptions/:prescriptionId` - Get prescription details
- `GET /api/prescriptions/patient/:patientId` - Get patient prescriptions
- `POST /api/prescriptions` - Create prescription (doctor)
- `PUT /api/prescriptions/:prescriptionId` - Update prescription

### Appointments
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/doctor/:doctorId` - Get doctor appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:appointmentId` - Update appointment
- `DELETE /api/appointments/:appointmentId` - Delete appointment

### Lab Requests
- `GET /api/lab-requests` - Get all lab requests
- `POST /api/lab-requests` - Create lab request (doctor)
- `PUT /api/lab-requests/:requestId` - Update lab request

### Radiology
- `GET /api/radiology` - Get all radiology requests
- `POST /api/radiology` - Create radiology request (doctor)
- `PUT /api/radiology/:requestId` - Update radiology request

### Pharmacy
- `GET /api/pharmacy/prescriptions` - Get prescriptions (pharmacy)
- `GET /api/pharmacy/inventory` - Get pharmacy inventory
- `PUT /api/pharmacy/dispense/:prescriptionId` - Dispense prescription

### Nursing
- `POST /api/nurse/vitals` - Record patient vitals
- `GET /api/nurse/vitals/patient/:patientId` - Get patient vitals
- `POST /api/nurse/care-notes` - Add care note
- `GET /api/nurse/patients` - Get admitted patients

### Billing
- `GET /api/billing` - Get all invoices
- `GET /api/billing/:invoiceId` - Get invoice details
- `POST /api/billing` - Create invoice
- `PUT /api/billing/:invoiceId` - Update invoice payment status

### Inventory
- `GET /api/inventory` - Get inventory items
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/:itemId` - Update inventory item

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `GET /api/admin/activities` - Get activity log
- `GET /api/admin/health` - Get system health
- `GET /api/admin/billing-overview` - Get billing overview
- `GET /api/admin/reports` - Get system reports

### Departments
- `GET /api/departments` - Get all departments
- `GET /api/departments/:departmentId` - Get department details

### Queue
- `GET /api/queue/:departmentId` - Get queue data
- `PUT /api/queue/:departmentId/current-token` - Update current token

## 🔐 Role-Based Access Control

Roles and their permissions:

| Role | Features |
|------|----------|
| **admin** | Full system access, user management, department management, reports |
| **doctor** | Patient consultation, prescriptions, lab/radiology requests, referrals |
| **receptionist** | Patient registration, appointment scheduling, queue management |
| **pharmacy** | Prescription dispensing, pharmacy inventory |
| **laboratory** | Lab test requests, sample collection, results entry |
| **radiologist** | Radiology requests, report upload |
| **nurse** | Patient vitals, care notes, ward management |
| **billing** | Invoice generation, payment processing |
| **inventory** | Stock management, procurement |

## 📁 Project Structure

```
backend/
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management
│   ├── patients.js          # Patient management
│   ├── prescriptions.js     # Doctor prescriptions
│   ├── appointments.js      # Appointment scheduling
│   ├── labRequests.js       # Lab test requests
│   ├── radiology.js         # Radiology requests
│   ├── pharmacy.js          # Pharmacy operations
│   ├── nurse.js             # Nursing operations
│   ├── billing.js           # Billing operations
│   ├── inventory.js         # Inventory management
│   ├── admin.js             # Admin operations
│   ├── departments.js       # Department management
│   └── queue.js             # Queue display
├── middleware/
│   └── auth.js              # JWT verification & role checking
├── utils/
│   ├── database.js          # In-memory data stores
│   └── helpers.js           # Helper functions
├── server.js                # Express app setup
├── package.json             # Dependencies
└── .env.example             # Environment variables template
```

## 🔄 Frontend Integration

The frontend connects to the backend via the API client (`src/utils/api.js`).

### Running Frontend & Backend Together

1. **Terminal 1 - Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Terminal 2 - Start Frontend**
   ```bash
   cd health-hub
   npm run dev
   ```

3. **Open in Browser**
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:5000`

### API Endpoints Configuration

The frontend is configured to connect to `http://localhost:5000/api`. To change this, set the environment variable:

```bash
REACT_APP_API_URL=http://your-api-url/api npm run dev
```

## 🗄️ Data Storage

Currently, the backend uses **in-memory data stores** for quick setup without database dependencies. To use a real database:

1. **Install MongoDB**
2. Uncomment the MongoDB connection in `server.js`
3. Create Mongoose models in `models/` directory
4. Update routes to use database queries instead of array operations

## 🛡️ Authentication Flow

1. **Login/Signup** 
   - User submits credentials → Backend validates → Returns JWT token
   - Frontend stores token in localStorage

2. **Protected Requests**
   - Frontend includes token in Authorization header
   - Backend verifies token using `verifyToken` middleware
   - Request proceeds if valid

3. **Token Expiration**
   - Default: 7 days
   - User needs to login again when expired

## 📝 Example API Calls

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmad@smarthospital.com",
    "password": "password123",
    "role": "doctor"
  }'
```

### Create Patient
```bash
curl -X POST http://localhost:5000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "forceNo": "F-12345",
    "firstName": "Muhammad",
    "lastName": "Ali",
    "gender": "Male",
    "dateOfBirth": "1990-01-15",
    "bloodGroup": "O+",
    "phone": "0300-1234567",
    "email": "patient@email.com",
    "address": "123 Main St",
    "city": "Karachi"
  }'
```

### Create Prescription
```bash
curl -X POST http://localhost:5000/api/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientId": "patient-uuid",
    "mrNo": "MR-001234",
    "forceNo": "F-12345",
    "diagnosis": "Hypertension",
    "medicines": [
      {
        "name": "Amlodipine",
        "dosage": "5mg",
        "frequency": "Once daily",
        "duration": "30 days",
        "instructions": "Take in the morning"
      }
    ],
    "labTests": ["Complete Blood Count"],
    "notes": "Follow-up after 2 weeks"
  }'
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### CORS Issues
- Ensure `FRONTEND_URL` in `.env` matches your frontend URL
- Default: `http://localhost:5173`

### Token Issues
- Clear browser localStorage if token is invalid
- Check token expiration (default 7 days)

## 📚 Database Migration (Optional)

To upgrade from in-memory storage to MongoDB:

1. Install dependencies: `npm install mongoose`
2. Create models in `models/` folder
3. Update routes to use Mongoose models
4. Connect to MongoDB in `server.js`

Example model pattern:
```javascript
// models/Patient.js
const patientSchema = new Schema({
  forceNo: String,
  firstName: String,
  lastName: String,
  // ... other fields
});
```

## 🚀 Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   JWT_SECRET=secure_random_string_here
   MONGODB_URI=your_mongodb_connection_string
   FRONTEND_URL=https://yourdomain.com
   ```

2. **Security Measures**
   - Use strong JWT_SECRET
   - Enable HTTPS
   - Set appropriate CORS headers
   - Implement rate limiting

3. **Deploy**
   - Use PM2 or similar for process management
   - Use reverse proxy (nginx) for load balancing
   - Set up monitoring and logging

## 📞 Support

For issues or questions:
- Check the logs for error details
- Verify all required fields are provided in API requests
- Ensure backend is running before making requests from frontend

## 📄 License

ISC
