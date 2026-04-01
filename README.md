🏗️ QBuild – Microservices-Based Audit Management System
📌 Overview

QBuild is a scalable, microservices-based web application designed to manage audit workflows efficiently.
It supports user authentication, role-based access, audit tracking, and is deployed using Kubernetes.

🚀 Features
🔐 User Authentication (JWT-based)
👥 Role-Based Access (Admin/User)
📊 Dashboard (User Info + Navigation)
📝 Audit Management (Create & List Audits)
🌐 API Gateway (Centralized Routing)
🗄️ MySQL Database Integration
☸️ Kubernetes Deployment (Scalable Architecture)
🐳 Dockerized Services
🏛️ Architecture
Frontend (React)
        ↓
API Gateway (Node.js)
        ↓
-------------------------
| Auth Service (Node.js) |
| Audit Service          |
-------------------------
        ↓
MySQL Database
🧱 Tech Stack
Layer	Technology
Frontend	React
Backend	Node.js (Express)
Mobile	Flutter (Planned)
Database	MySQL
Container	Docker
Orchestration	Kubernetes
API Gateway	http-proxy-middleware
Auth	JWT + bcrypt
📂 Project Structure
QBuild/
│
├── frontend/
│   └── homepage/         # React App
│
├── gateway/
│   └── api-gateway/      # API Gateway
│
├── services/
│   ├── auth-service/     # Authentication Service
│   └── audit-service/    # Audit Service
│
├── k8s/                  # Kubernetes manifests
└── README.md
⚙️ Setup Instructions
1️⃣ Clone Repository
git clone https://github.com/<your-username>/QBuild.git
cd QBuild
2️⃣ Start Kubernetes (Minikube)
minikube start
eval $(minikube docker-env)
3️⃣ Build Docker Images
docker build -t qbuild-auth ./services/auth-service
docker build -t qbuild-gateway ./gateway/api-gateway
docker build -t qbuild-homepage ./frontend/homepage
4️⃣ Deploy to Kubernetes
kubectl apply -f k8s/
5️⃣ Access Application
http://qbuild.local
🔐 Authentication API
Login
POST /api/auth/login
Request:
{
  "email": "admin@qbuild.com",
  "password": "123456"
}
Response:
{
  "message": "Login Successful",
  "token": "JWT_TOKEN"
}
📝 Audit API
Create Audit
POST /api/audit
Get Audits
GET /api/audit
🧠 Learning Outcomes

This project demonstrates:

Microservices architecture
API Gateway pattern
JWT authentication
Database integration with Node.js
Kubernetes deployment
Debugging real production issues
🚀 Future Enhancements
✅ Assign audits to users
✅ Audit workflow (Pending → Completed)
⏳ Notifications system
⏳ File upload (audit proof)
⏳ CI/CD using GitHub Actions
⏳ Monitoring (Prometheus + Grafana)
👨‍💻 Author

Vishal Prajapati

⭐ Contribution

Feel free to fork, raise issues, and contribute!

📌 License

This project is licensed under the MIT License.
