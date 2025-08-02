#!/bin/sh
set -e

echo "Starting API Server..."

mkdir -p data

echo "Running database migrations..."
npm run db:generate
npm run db:migrate

echo "Starting the application..."
exec npm start 