#!/bin/bash

# Fix Firebase Deployment Error - Enable Required APIs
# This script enables all required Google Cloud APIs for Firebase Functions deployment

echo "🔧 Fixing Firebase Deployment Error..."
echo ""

# Set the Firebase project
PROJECT_ID="social-trends-29ac2"

echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "🔌 Enabling required APIs (this may take 1-2 minutes)..."
echo ""

# Enable required APIs
gcloud services enable pubsub.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable eventarc.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

echo ""
echo "✅ APIs enabled successfully!"
echo ""
echo "⏳ Waiting 30 seconds for APIs to propagate..."
sleep 30

echo ""
echo "🚀 Ready to deploy! Run:"
echo "   cd functions && npm run deploy"
echo ""
