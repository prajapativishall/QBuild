#!/bin/bash

echo "🚀 Starting QBuild System..."

minikube start --driver=docker

minikube addons enable ingress

eval $(minikube docker-env)

echo "🐳 Building Images..."

cd frontend/homepage && docker build -t qbuild-homepage:latest .
cd ../../gateway/api-gateway && docker build -t qbuild-gateway:latest .
cd ../../services/auth-service && docker build -t qbuild-auth:latest .

cd ../../

echo "☸️ Deploying to Kubernetes..."

kubectl apply -f k8s/

echo "✅ QBuild Started Successfully!"

echo "🌐 Open: http://qbuild.local"
