#!/bin/bash

# Kill any process on port 5002
echo "Checking for processes on port 5002..."
if lsof -ti:5002 > /dev/null; then
    echo "Killing processes on port 5002..."
    lsof -ti:5002 | xargs kill -9
else
    echo "No processes found on port 5002"
fi

# Kill any process on port 8080
echo "Checking for processes on port 8080..."
if lsof -ti:8080 > /dev/null; then
    echo "Killing processes on port 8080..."
    lsof -ti:8080 | xargs kill -9
else
    echo "No processes found on port 8080"
fi

# Kill any process on port 5000
echo "Checking for processes on port 5000..."
if lsof -ti:5000 > /dev/null; then
    echo "Killing processes on port 5000..."
    lsof -ti:5000 | xargs kill -9
else
    echo "No processes found on port 5000"
fi

# Start the app on port 5000
echo "Starting app on port 5000..."
PORT=5000 python app.py
