# Use the official Microsoft Playwright image which includes all OS-level browser dependencies
FROM mcr.microsoft.com/playwright/python:v1.45.0-jammy

# Set the working directory
WORKDIR /app

# Copy the requirements file and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend and frontend code to the container
COPY . .

# Ensure the database and screenshot directories exist
RUN mkdir -p data/screenshots static

# Expose the port Uvicorn will listen on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
