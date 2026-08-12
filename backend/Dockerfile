FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Source is volume-mounted in development; this copy is for production builds
COPY . .

# Make the entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 8000

# Run Alembic migrations then start FastAPI.
# No --reload: this is the production image.
CMD ["./entrypoint.sh"]
